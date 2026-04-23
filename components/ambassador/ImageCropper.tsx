'use client'

/**
 * Professional avatar (and listing-photo) cropper.
 *
 * Authoritative spec: `_features/ambassador/professional_avatar_cropper_final_UI_Spec.md`
 * Mockup: `_features/ambassador/professional_avatar_cropper_final.html`
 *
 * Full-screen overlay in the same visual language as the public media
 * lightbox (shared scrim values, chrome positioning, brand-pink token).
 * Parent passes a File; the cropper URL.createObjectURL's it, handles
 * drag + zoom within a circular (avatar) or rectangular (listing) frame,
 * and canvas-exports a JPEG Blob on Use.
 *
 * Principle I canonical component: every image-crop surface in the
 * ambassador feature uses this one.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Mode = 'avatar' | 'listing'

interface ImageCropperProps {
  sourceFile: File
  mode: Mode
  onCropComplete: (blob: Blob) => void
  onCancel: () => void
}

// Frame = on-screen crop container; Output = canvas export dimensions.
// Values match spec §4 and §11 build checklist.
const DIMS: Record<Mode, {
  frameW: number; frameH: number; outW: number; outH: number;
  shape: 'circle' | 'rect';
}> = {
  avatar:  { frameW: 280, frameH: 280, outW: 400,  outH: 400,  shape: 'circle' },
  listing: { frameW: 280, frameH: 498, outW: 720,  outH: 1280, shape: 'rect'   },
}

const BRAND_PINK = '#e91e8c'
const DIM_COLOR = 'rgba(0,0,0,0.55)'
const ZOOM_MIN = 1
const ZOOM_MAX = 4
const JPEG_QUALITY = 0.9

export function ImageCropper({ sourceFile, mode, onCropComplete, onCancel }: ImageCropperProps) {
  const dims = DIMS[mode]

  // Portal SSR guard — only mount after client hydration.
  const [portalReady, setPortalReady] = useState(false)
  useEffect(() => { setPortalReady(true) }, [])

  // Source URL lifecycle — create from File on mount, revoke on unmount.
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(sourceFile)
    setSourceUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [sourceFile])

  // Natural image size + pan + zoom state.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const dragRef = useRef({ active: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0 })
  const imgElRef = useRef<HTMLImageElement | null>(null)

  // Viewport size for the full-viewport dim mask. Tracks resize so the
  // mask + frame border stay aligned when mobile URL bar toggles or the
  // device rotates. Initialized to 0 and populated by the mount effect —
  // SVG is guarded to render only once w > 0 to avoid a zero-sized first
  // frame.
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const update = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Cover-fit math: at zoom=1, the image's shorter side fills the frame.
  const baseScale = natural
    ? Math.max(dims.frameW / natural.w, dims.frameH / natural.h)
    : 1
  const renderedW = natural ? natural.w * baseScale * zoom : 0
  const renderedH = natural ? natural.h * baseScale * zoom : 0

  const clampPos = useCallback((x: number, y: number, z: number) => {
    if (!natural) return { x: 0, y: 0 }
    const rW = natural.w * baseScale * z
    const rH = natural.h * baseScale * z
    const maxX = Math.max(0, (rW - dims.frameW) / 2)
    const maxY = Math.max(0, (rH - dims.frameH) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    }
  }, [natural, baseScale, dims.frameW, dims.frameH])

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget
    setNatural({ w: el.naturalWidth, h: el.naturalHeight })
    setZoom(1)
    setPos({ x: 0, y: 0 })
  }, [])

  const handleZoomChange = useCallback((next: number) => {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next))
    setZoom(clamped)
    setPos((prev) => clampPos(prev.x, prev.y, clamped))
  }, [clampPos])

  // Drag handlers (mouse + single-finger touch). Document-level listeners
  // keep drag continuous past the container edge.
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = {
      active: true, startX: e.clientX, startY: e.clientY,
      startPosX: pos.x, startPosY: pos.y,
    }
    setDragging(true)
  }
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    dragRef.current = {
      active: true, startX: e.touches[0].clientX, startY: e.touches[0].clientY,
      startPosX: pos.x, startPosY: pos.y,
    }
    setDragging(true)
  }

  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      if (!dragRef.current.active) return
      const dx = clientX - dragRef.current.startX
      const dy = clientY - dragRef.current.startY
      setPos(clampPos(dragRef.current.startPosX + dx, dragRef.current.startPosY + dy, zoom))
    }
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current.active || e.touches.length !== 1) return
      onMove(e.touches[0].clientX, e.touches[0].clientY)
    }
    const onEnd = () => {
      if (!dragRef.current.active) return
      dragRef.current.active = false
      setDragging(false)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchend', onEnd)
    }
  }, [zoom, clampPos])

  // Escape → cancel (spec §8).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Canvas export — spec §6 math, unchanged from prior implementation.
  // Samples from natural-resolution source, outputs JPEG Blob quality 0.9.
  const handleUse = useCallback(() => {
    if (!natural || !imgElRef.current || !sourceUrl) return
    const canvas = document.createElement('canvas')
    canvas.width = dims.outW
    canvas.height = dims.outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const srcScale = natural.w / renderedW
    const srcW = dims.frameW * srcScale
    const srcH = dims.frameH * srcScale
    const srcX = (natural.w - srcW) / 2 - (pos.x * srcScale)
    const srcY = (natural.h - srcH) / 2 - (pos.y * srcScale)
    ctx.drawImage(imgElRef.current, srcX, srcY, srcW, srcH, 0, 0, dims.outW, dims.outH)
    canvas.toBlob((blob) => { if (blob) onCropComplete(blob) }, 'image/jpeg', JPEG_QUALITY)
  }, [natural, renderedW, pos.x, pos.y, dims.frameW, dims.frameH, dims.outW, dims.outH, sourceUrl, onCropComplete])

  if (!portalReady || !sourceUrl) return null

  const zoomPct = ((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop photo"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 200,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#fff',
      }}
    >
      {/* Scrim top — z-index 1 */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 110,
        background: 'linear-gradient(rgba(0,0,0,0.55), transparent)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      {/* Scrim bottom — z-index 1 */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 170,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.92))',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Cancel (X, top-left) — z-index 4 */}
      <div
        onClick={onCancel}
        role="button"
        aria-label="Cancel"
        style={{
          position: 'absolute',
          top: 20, left: 18,
          width: 32, height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 4,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>

      {/* Title (center, top) — z-index 4, non-interactive */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        height: 32,
        display: 'flex',
        alignItems: 'center',
        fontSize: 14,
        fontWeight: 500,
        color: '#fff',
        zIndex: 4,
        pointerEvents: 'none',
      }}>
        Crop photo
      </div>

      {/* Use (top-right) — z-index 4 */}
      <div
        onClick={handleUse}
        role="button"
        aria-label="Use cropped image"
        style={{
          position: 'absolute',
          top: 20, right: 18,
          height: 32,
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 600,
          color: BRAND_PINK,
          cursor: 'pointer',
          zIndex: 4,
        }}
      >
        Use
      </div>

      {/* Crop stage — z-index 2 */}
      <div style={{
        position: 'absolute',
        top: 70, bottom: 170, left: 0, right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
      }}>
        <div
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          style={{
            position: 'relative',
            width: dims.frameW,
            height: dims.frameH,
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgElRef}
            src={sourceUrl}
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
              maxHeight: 'none',
              transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
              pointerEvents: 'none',
              userSelect: 'none',
              WebkitUserDrag: 'none',
            } as React.CSSProperties}
          />

        </div>
      </div>

      {/* Full-viewport dim + frame border — single SVG overlay sibling.
          Pixel-coordinate SVG (no viewBox) sized to window inner dims.
          Mask uses maskUnits=userSpaceOnUse so the cutout coordinates
          match the outer rect's pixel space. Frame border rendered
          inside the same SVG so it overlays the cutout crisply.
          pointerEvents:none so drag events still reach the crop
          container below. z-index 3 sits above the crop stage (2) and
          the scrims (1), below the chrome (4). */}
      {viewportSize.w > 0 && (() => {
        const cx = viewportSize.w / 2
        // Crop stage spans top:70 to bottom:170; its vertical center
        // is (vh - 240)/2 + 70 = vh/2 - 50.
        const cy = viewportSize.h / 2 - 50
        const halfW = dims.frameW / 2
        const halfH = dims.frameH / 2
        const isCircle = dims.shape === 'circle'
        return (
          <svg
            width={viewportSize.w}
            height={viewportSize.h}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 3 }}
          >
            <defs>
              <mask id={`cropperMask-${mode}`} maskUnits="userSpaceOnUse" x="0" y="0" width={viewportSize.w} height={viewportSize.h}>
                <rect x="0" y="0" width={viewportSize.w} height={viewportSize.h} fill="white" />
                {isCircle ? (
                  <circle cx={cx} cy={cy} r={Math.min(halfW, halfH)} fill="black" />
                ) : (
                  <rect x={cx - halfW} y={cy - halfH} width={dims.frameW} height={dims.frameH} rx={8} fill="black" />
                )}
              </mask>
            </defs>
            <rect x="0" y="0" width={viewportSize.w} height={viewportSize.h} fill={DIM_COLOR} mask={`url(#cropperMask-${mode})`} />
            {isCircle ? (
              <circle cx={cx} cy={cy} r={Math.min(halfW, halfH)} fill="none" stroke="#fff" strokeWidth="2" />
            ) : (
              <rect x={cx - halfW} y={cy - halfH} width={dims.frameW} height={dims.frameH} rx={8} fill="none" stroke="#fff" strokeWidth="2" />
            )}
          </svg>
        )
      })()}

      {/* Slider — z-index 3 */}
      <div style={{
        position: 'absolute',
        bottom: 48, left: 0, right: 0,
        padding: '0 32px',
        zIndex: 3,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 20 }}>
          {/* Minus icon (10x10 viewBox, 1.5 stroke, rgba white 75) */}
          <div style={{ width: 14, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="5" x2="9" y2="5" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Custom track + fill + thumb + invisible native range overlay */}
          <div style={{ flex: 1, position: 'relative', height: 2, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
            <div style={{
              position: 'absolute', left: 0, top: 0,
              height: '100%', width: `${zoomPct}%`,
              background: BRAND_PINK, borderRadius: 2,
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: `${zoomPct}%`,
              width: 14, height: 14, marginTop: -7, marginLeft: -7,
              background: '#fff', borderRadius: '50%',
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              cursor: 'grab',
            }} />
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.01}
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              aria-label="Zoom"
              style={{
                position: 'absolute',
                inset: -10,
                width: 'calc(100% + 20px)',
                height: 40,
                opacity: 0,
                cursor: 'pointer',
                margin: 0,
                padding: 0,
              }}
            />
          </div>

          {/* Plus icon */}
          <div style={{ width: 14, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="5" x2="9" y2="5" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5" y1="1" x2="5" y2="9" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          marginTop: 12,
        }}>
          Drag to position · Slider to zoom
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}
