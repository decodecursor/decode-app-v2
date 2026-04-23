'use client'

/**
 * Canonical image cropper for the ambassador surface.
 *
 * Locked during Slice 3B per CLAUDE_CODE_HANDOFF.md (Slice 3B locked
 * decisions #2). Every image-crop surface — avatar, listing photos,
 * any future crop consumer — should use this component (Principle I).
 *
 * Props-driven, zero coupling to Add Listing. The component owns its
 * full-screen overlay chrome, zoom/pan UX, and canvas export. Callers
 * pass the source image + target dimensions and receive a cropped
 * Blob on confirm.
 *
 * UX translated from add_listing_final.html:168-603 (the mockup's
 * inline cropper) and matches the spec's crop dimensions (400x400
 * for avatar, 720x1280 for listing media).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

type Shape = 'circle' | 'rect'

interface Props {
  open: boolean
  source: string | null
  targetWidth: number
  targetHeight: number
  /** Visual frame shape. 'circle' only renders correctly when target is square. */
  shape?: Shape
  /** Header title. Defaults to "Crop photo". */
  title?: string
  /** JPEG quality, 0-1. Defaults to 0.9 to match mockup. */
  quality?: number
  onCancel: () => void
  onCrop: (blob: Blob) => void
}

const MAX_WINDOW_WIDTH = 320
const MAX_WINDOW_HEIGHT = 560
const MIN_ZOOM = 1
const MAX_ZOOM = 4

function computeWindow(targetWidth: number, targetHeight: number) {
  const aspect = targetWidth / targetHeight
  let windowW = MAX_WINDOW_WIDTH
  let windowH = windowW / aspect
  if (windowH > MAX_WINDOW_HEIGHT) {
    windowH = MAX_WINDOW_HEIGHT
    windowW = windowH * aspect
  }
  return { w: Math.round(windowW), h: Math.round(windowH) }
}

export function ImageCropper({
  open,
  source,
  targetWidth,
  targetHeight,
  shape = 'rect',
  title = 'Crop photo',
  quality = 0.9,
  onCancel,
  onCrop,
}: Props) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 })

  const windowDims = computeWindow(targetWidth, targetHeight)
  const frameRadius = shape === 'circle' ? '50%' : '8px'

  // Reset transform whenever the source changes or the modal is opened.
  useEffect(() => {
    if (!open) return
    setNatural(null)
    setZoom(1)
    setPos({ x: 0, y: 0 })
  }, [open, source])

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    setZoom(1)
    setPos({ x: 0, y: 0 })
  }, [])

  // Scale factor: image always fills the window at zoom=1.
  const baseScale = natural
    ? Math.max(windowDims.w / natural.w, windowDims.h / natural.h)
    : 1
  const renderedW = natural ? natural.w * baseScale * zoom : 0
  const renderedH = natural ? natural.h * baseScale * zoom : 0
  const maxX = Math.max(0, (renderedW - windowDims.w) / 2)
  const maxY = Math.max(0, (renderedH - windowDims.h) / 2)

  const clampPos = useCallback((x: number, y: number, z: number) => {
    if (!natural) return { x: 0, y: 0 }
    const rW = natural.w * baseScale * z
    const rH = natural.h * baseScale * z
    const mX = Math.max(0, (rW - windowDims.w) / 2)
    const mY = Math.max(0, (rH - windowDims.h) / 2)
    return {
      x: Math.max(-mX, Math.min(mX, x)),
      y: Math.max(-mY, Math.min(mY, y)),
    }
  }, [natural, baseScale, windowDims.w, windowDims.h])

  const handleZoomChange = useCallback((next: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next))
    setZoom(clamped)
    setPos((prev) => clampPos(prev.x, prev.y, clamped))
  }, [clampPos])

  // Drag handlers — document-level listeners so drag continues past the container edge.
  useEffect(() => {
    if (!open) return
    const onMove = (clientX: number, clientY: number) => {
      if (!dragRef.current.active) return
      const dx = clientX - dragRef.current.startX
      const dy = clientY - dragRef.current.startY
      setPos(clampPos(dragRef.current.startPosX + dx, dragRef.current.startPosY + dy, zoom))
    }
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current.active) return
      e.preventDefault()
      onMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onEnd = () => { dragRef.current.active = false }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchend', onEnd)
    }
  }, [open, zoom, clampPos])

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = {
      active: true, startX: e.clientX, startY: e.clientY,
      startPosX: pos.x, startPosY: pos.y,
    }
  }
  const onTouchStart = (e: React.TouchEvent) => {
    dragRef.current = {
      active: true, startX: e.touches[0].clientX, startY: e.touches[0].clientY,
      startPosX: pos.x, startPosY: pos.y,
    }
  }

  const handleCrop = useCallback(() => {
    if (!source || !natural) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      // Compute source rect on the original image that corresponds to the
      // current window view. The window is (windowW x windowH); the image
      // is translated by (pos.x, pos.y) from the window center.
      const imgLeftInWindow = windowDims.w / 2 + pos.x - renderedW / 2
      const imgTopInWindow = windowDims.h / 2 + pos.y - renderedH / 2
      const sx = (-imgLeftInWindow / renderedW) * natural.w
      const sy = (-imgTopInWindow / renderedH) * natural.h
      const sw = (windowDims.w / renderedW) * natural.w
      const sh = (windowDims.h / renderedH) * natural.h
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)
      canvas.toBlob((blob) => { if (blob) onCrop(blob) }, 'image/jpeg', quality)
    }
    img.src = source
  }, [source, natural, targetWidth, targetHeight, windowDims.w, windowDims.h, renderedW, renderedH, pos.x, pos.y, quality, onCrop])

  if (!open || !source) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.97)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #1a1a1a',
      }}>
        <div onClick={onCancel} style={{ fontSize: 14, color: '#888', cursor: 'pointer', padding: 4, userSelect: 'none' }}>
          Cancel
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{title}</div>
        <div onClick={handleCrop} style={{ fontSize: 14, color: '#e91e8c', fontWeight: 600, cursor: 'pointer', padding: 4, userSelect: 'none' }}>
          Use
        </div>
      </div>

      {/* Crop window */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0' }}>
        <div
          ref={containerRef}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          style={{
            position: 'relative',
            width: windowDims.w,
            height: windowDims.h,
            overflow: 'hidden',
            background: '#0a0a0a',
            borderRadius: frameRadius,
            cursor: dragRef.current.active ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          <img
            src={source}
            alt=""
            draggable={false}
            onLoad={onImageLoad}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: renderedW || 'auto',
              height: renderedH || 'auto',
              maxWidth: 'none',
              transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
              pointerEvents: 'none',
            }}
          />
          {/* Frame overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            border: '2px solid #fff',
            pointerEvents: 'none',
            borderRadius: frameRadius,
          }} />
        </div>
      </div>

      {/* Zoom control */}
      <div style={{ padding: '0 24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#e91e8c' }}
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 6 }}>
          Drag to position · Slider to zoom
        </div>
      </div>
    </div>
  )
}
