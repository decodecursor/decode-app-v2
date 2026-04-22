'use client'

/**
 * Cover photo with drag-to-reposition.
 *
 * Three modes:
 * - 'fixed'      — Settings default: camera button bottom-right, drag disabled.
 * - 'editing'    — Settings edit mode: Drag pill + Upload/Remove/Done chrome, drag enabled.
 * - 'onboarding' — /model/setup: always-draggable, fade-on-drag "Drag to reposition"
 *                  pill (fades out 1s after drag end per onboarding UI Spec §5),
 *                  decorative camera icon, no edit chrome.
 *
 * Component is pure UI + drag callbacks. Parents decide persistence: Settings
 * PATCHes live on each callback; /model/setup stages and submits via its own
 * form FormData. No internal fetch.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CoverCameraButton } from '@/components/ambassador/CoverCameraButton'

type CoverPhotoProps = {
  url: string | null
  positionY: number
  mode: 'fixed' | 'editing' | 'onboarding'
  onPositionChange: (y: number) => void
  onUploadClick: () => void
  onEnterEditMode?: () => void
  onExitEditMode?: () => void
  onRemoveClick?: () => void
  emptyStateText?: string
}

const iconBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: 'rgba(28,28,28,0.85)',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
}

export function CoverPhoto({
  url,
  positionY,
  mode,
  onPositionChange,
  onUploadClick,
  onEnterEditMode,
  onExitEditMode,
  onRemoveClick,
  emptyStateText,
}: CoverPhotoProps) {
  const [dragging, setDragging] = useState(false)
  const [livePos, setLivePos] = useState(positionY)
  const [editVisible, setEditVisible] = useState(false)
  const [pillLingerVisible, setPillLingerVisible] = useState(false)
  const dragStartY = useRef(0)
  const dragStartPos = useRef(50)
  const pillTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!dragging) setLivePos(positionY)
  }, [positionY, dragging])

  useEffect(() => {
    if (mode !== 'editing') {
      setEditVisible(false)
      return
    }
    const id = requestAnimationFrame(() => setEditVisible(true))
    return () => cancelAnimationFrame(id)
  }, [mode])

  useEffect(() => {
    if (mode !== 'editing' || !onExitEditMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExitEditMode()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mode, onExitEditMode])

  const dragEnabled = (mode === 'editing' || mode === 'onboarding') && !!url

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragEnabled) return
    setDragging(true)
    if (mode === 'onboarding') {
      if (pillTimer.current) {
        clearTimeout(pillTimer.current)
        pillTimer.current = null
      }
      setPillLingerVisible(true)
    }
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
    dragStartPos.current = livePos || 50
  }

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const delta = clientY - dragStartY.current
    const newPos = Math.max(0, Math.min(100, dragStartPos.current - delta * 0.5))
    setLivePos(Math.round(newPos))
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragging(false)
    onPositionChange(livePos)
    if (mode === 'onboarding') {
      if (pillTimer.current) clearTimeout(pillTimer.current)
      pillTimer.current = setTimeout(() => {
        setPillLingerVisible(false)
        pillTimer.current = null
      }, 1000)
    }
  }, [livePos, onPositionChange, mode])

  useEffect(() => {
    if (!dragging) return
    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
    window.addEventListener('touchmove', handleDragMove)
    window.addEventListener('touchend', handleDragEnd)
    return () => {
      window.removeEventListener('mousemove', handleDragMove)
      window.removeEventListener('mouseup', handleDragEnd)
      window.removeEventListener('touchmove', handleDragMove)
      window.removeEventListener('touchend', handleDragEnd)
    }
  }, [dragging, handleDragMove, handleDragEnd])

  useEffect(() => {
    return () => {
      if (pillTimer.current) clearTimeout(pillTimer.current)
    }
  }, [])

  const handleBoxClick = () => {
    if (!url) onUploadClick()
  }

  const onboardingPillVisible = mode === 'onboarding' && (dragging || pillLingerVisible)

  return (
    <div
      onMouseDown={dragEnabled ? handleDragStart : undefined}
      onTouchStart={dragEnabled ? handleDragStart : undefined}
      onClick={handleBoxClick}
      style={{
        position: 'relative',
        height: 120,
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 16,
        backgroundImage: url ? `url(${url})` : 'linear-gradient(135deg,#2a2a2a 0%,#0a0a0a 100%)',
        backgroundSize: 'cover',
        backgroundPosition: `center ${livePos}%`,
        backgroundRepeat: 'no-repeat',
        userSelect: 'none',
        touchAction: dragEnabled ? 'none' : 'auto',
        cursor: url
          ? (mode === 'editing' || mode === 'onboarding')
            ? (dragging ? 'grabbing' : 'grab')
            : 'default'
          : 'pointer',
      }}
    >
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 50,
        background: 'linear-gradient(transparent,rgba(0,0,0,0.6))',
        pointerEvents: 'none',
      }} />

      {!url && emptyStateText && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: '#666',
          pointerEvents: 'none',
        }}>
          {emptyStateText}
        </div>
      )}

      {mode === 'editing' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: editVisible ? 1 : 0,
          transition: 'opacity 200ms',
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute',
            top: 10,
            left: 10,
            height: 34,
            padding: '0 14px',
            background: 'rgba(28,28,28,0.85)',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: '#fff',
            fontSize: 11,
            fontWeight: 500,
            userSelect: 'none',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="4" x2="12" y2="20" />
              <polyline points="6 8 12 4 18 8" />
              <polyline points="6 16 12 20 18 16" />
            </svg>
            Drag
          </div>

          <div
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              pointerEvents: 'auto',
            }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onUploadClick() }}
              style={iconBtn}
              aria-label="Upload new photo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemoveClick?.() }}
              style={iconBtn}
              aria-label="Remove photo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onExitEditMode?.() }}
              style={{
                height: 34,
                padding: '0 16px',
                background: '#e91e8c',
                borderRadius: 999,
                border: 'none',
                color: '#fff',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {mode === 'onboarding' && url && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          fontSize: 9,
          color: '#fff',
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '4px 9px',
          borderRadius: 12,
          pointerEvents: 'none',
          letterSpacing: '0.3px',
          opacity: onboardingPillVisible ? 1 : 0,
          transition: 'opacity 0.3s',
        }}>
          Drag to reposition
        </div>
      )}

      {mode === 'onboarding' && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 10,
            right: 16,
            width: 28,
            height: 28,
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
      )}

      {mode === 'fixed' && (
        <CoverCameraButton
          size={34}
          onClick={(e) => {
            e.stopPropagation()
            if (url) onEnterEditMode?.()
            else onUploadClick()
          }}
        />
      )}
    </div>
  )
}
