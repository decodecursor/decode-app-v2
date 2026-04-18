'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  slug: string
  first_name: string
  last_name: string
  cover_photo_url: string | null
  cover_photo_position_y: number
  is_published: boolean
  gifts_enabled: boolean
}

interface TopClick {
  category: string
  clicks: number
}

export default function DashboardClient({
  profile,
  isFirstVisit,
  viewsTotal,
  viewsThisWeek,
  topClicks,
  expiringCount,
}: {
  profile: Profile
  isFirstVisit: boolean
  viewsTotal: number
  viewsThisWeek: number
  topClicks: TopClick[]
  expiringCount: number
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [barsLoaded, setBarsLoaded] = useState(false)
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pageUrl = `welovedecode.com/${profile.slug}`
  const fullUrl = `https://${pageUrl}`

  useEffect(() => {
    const id = requestAnimationFrame(() => setBarsLoaded(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => () => {
    if (copyResetRef.current) clearTimeout(copyResetRef.current)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 1800)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
    } catch {
      // ignore — clipboard may be unavailable
    }
    setCopied(true)
    if (copyResetRef.current) clearTimeout(copyResetRef.current)
    copyResetRef.current = setTimeout(() => setCopied(false), 1500)
  }

  const openPublic = () => {
    window.location.href = fullUrl
  }

  const navigatePlaceholder = (label: string) => {
    showToast(`${label} — coming soon`)
  }

  const maxClicks = topClicks.reduce((m, c) => (c.clicks > m ? c.clicks : m), 0)

  return (
    <div style={{ paddingBottom: '24px', position: 'relative' }}>
      {/* Cover */}
      <div style={{
        margin: '14px 20px 0',
        borderRadius: '14px',
        overflow: 'hidden',
        position: 'relative',
        height: '110px',
        background: profile.cover_photo_url
          ? `url(${profile.cover_photo_url}) center ${profile.cover_photo_position_y}% / cover no-repeat`
          : 'linear-gradient(135deg, #e91e8c, #ff6b9d)',
      }}>
        {/* Fade */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: 'linear-gradient(transparent, #000)',
        }} />
        {/* Bottom row: greeting+url left, icons right */}
        <div style={{
          position: 'absolute',
          bottom: '11px',
          left: '16px',
          right: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '19px',
              fontWeight: 700,
              letterSpacing: '-0.2px',
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {isFirstVisit
                ? `${profile.first_name}, you\u2019re live! \uD83C\uDF89`
                : `Hello ${profile.first_name}`}
            </div>
            <div
              onClick={openPublic}
              style={{
                fontSize: '11px',
                color: '#888',
                marginTop: '2px',
                cursor: 'pointer',
                display: 'inline-block',
              }}
            >
              {pageUrl}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '7px' }}>
            <button
              onClick={handleCopy}
              title="Copy link"
              style={{
                position: 'relative',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: copied ? 'rgba(74,222,128,0.18)' : 'rgba(0,0,0,0.55)',
                border: copied ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
              {copied && (
                <span style={{
                  position: 'absolute',
                  bottom: '34px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#4ade80',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}>
                  Copied!
                </span>
              )}
            </button>
            <button
              onClick={openPublic}
              title="View public page"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: '11px' }}>
        <div style={{
          width: 108,
          flexShrink: 0,
          background: '#1c1c1c',
          borderRadius: '12px',
          padding: '13px 14px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Total views
          </div>
          <div style={{ fontSize: '30px', fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: '-0.5px' }}>
            {viewsTotal}
          </div>
          <div style={{ fontSize: '9px', color: '#666', marginTop: '6px' }}>
            {viewsTotal === 0 ? 'Share your page to get started' : `+${viewsThisWeek} this week`}
          </div>
        </div>
        <div style={{
          flex: 1,
          background: '#1c1c1c',
          borderRadius: '12px',
          padding: '13px 15px',
        }}>
          <div style={{ fontSize: '9px', color: '#666', marginBottom: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Top clicks
          </div>
          {topClicks.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#555', textAlign: 'center', paddingTop: '8px' }}>
              No clicks yet
            </div>
          ) : (
            topClicks.map((row, i) => {
              const target = maxClicks === 0 ? 0 : Math.round((row.clicks / maxClicks) * 100)
              const size = barsLoaded ? `${target}% 100%, 100% 100%` : '0% 100%, 100% 100%'
              return (
                <div key={`${row.category}-${i}`} style={{ marginBottom: i === topClicks.length - 1 ? 0 : '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#fff' }}>{row.category}</span>
                    <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>{row.clicks}</span>
                  </div>
                  <div style={{
                    height: '2px',
                    backgroundImage: 'linear-gradient(#e91e8c,#e91e8c),linear-gradient(#3a3a3a,#3a3a3a)',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: size,
                    transition: 'background-size 1500ms cubic-bezier(.2,.7,.2,1)',
                  }} />
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Primary actions */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: '10px' }}>
        {/* TODO(slice-2-or-3): swap to router.push('/model/listings/new') when route ships */}
        <button
          onClick={() => navigatePlaceholder('Add Listing')}
          style={{
            flex: 1,
            borderRadius: '12px',
            padding: '14px',
            border: 'none',
            background: '#e91e8c',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Listing
        </button>
        {/* TODO(slice-2-or-3): swap to router.push('/model/wishlist/new') when route ships */}
        <button
          onClick={() => navigatePlaceholder('Add Wish')}
          style={{
            flex: 1,
            borderRadius: '12px',
            padding: '14px',
            border: 'none',
            background: '#1c1c1c',
            color: '#e91e8c',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e91e8c" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Wish
        </button>
      </div>

      {/* Nav cards */}
      <div style={{ padding: '0 20px 18px' }}>
        <NavCard
          /* TODO(slice-2-or-3): swap onClick to router.push('/model/listings') */
          onClick={() => navigatePlaceholder('Listings')}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e91e8c" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          )}
          label="Listings"
          alert={expiringCount > 0 ? `${expiringCount} expiring soon` : null}
        />
        <NavCard
          /* TODO(slice-2-or-3): swap onClick to router.push('/model/wishlist') */
          onClick={() => navigatePlaceholder('Wishlist')}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e91e8c" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          )}
          label="Wishlist"
        />
        <NavCard
          /* TODO(slice-2-or-3): swap onClick to router.push('/model/analytics') */
          onClick={() => navigatePlaceholder('Analytics')}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e91e8c" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          )}
          label="Analytics"
        />
        <NavCard
          onClick={() => router.push('/model/settings')}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e91e8c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          )}
          label="Settings"
        />
      </div>

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(28,28,28,0.95)',
          border: '1px solid #333',
          color: '#fff',
          fontSize: '12px',
          padding: '10px 18px',
          borderRadius: '24px',
          zIndex: 50,
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function NavCard({
  icon,
  label,
  alert,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  alert?: string | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: '#1c1c1c',
        border: 'none',
        borderRadius: '12px',
        marginBottom: '9px',
        padding: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {icon}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{label}</span>
          {alert && (
            <>
              <span style={{
                width: '3px',
                height: '3px',
                borderRadius: '50%',
                background: '#555',
                display: 'inline-block',
                alignSelf: 'center',
                transform: 'translateY(1px)',
              }} />
              <span style={{ fontSize: '11px', color: '#e91e8c' }}>{alert}</span>
            </>
          )}
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}
