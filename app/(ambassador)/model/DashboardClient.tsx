'use client'

import { useState } from 'react'
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

export default function DashboardClient({
  profile,
  isFirstVisit,
}: {
  profile: Profile
  isFirstVisit: boolean
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const pageUrl = `welovedecode.com/${profile.slug}`
  const fullUrl = `https://${pageUrl}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Cover section */}
      <div style={{
        height: '110px',
        borderRadius: '0 0 14px 14px',
        background: profile.cover_photo_url
          ? `url(${profile.cover_photo_url}) center ${profile.cover_photo_position_y}% / cover no-repeat`
          : 'linear-gradient(135deg, #333, #222, #111)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Fade overlay */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50px',
          background: 'linear-gradient(transparent, #000)',
        }} />
      </div>

      {/* Greeting + URL */}
      <div style={{ padding: '16px 24px 0' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}>
          <h1 style={{
            fontSize: '19px',
            fontWeight: 700,
            color: '#fff',
          }}>
            {isFirstVisit
              ? `${profile.first_name}, you're live! \ud83c\udf89`
              : `Hello ${profile.first_name}`}
          </h1>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
        }}>
          <span style={{ fontSize: '11px', color: '#888' }}>{pageUrl}</span>
          <button
            onClick={handleCopy}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid #262626',
              color: copied ? '#4ade80' : '#888',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s',
            }}
          >
            {copied ? '✓' : '⎘'}
          </button>
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid #262626',
              color: '#888',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            ↗
          </a>
        </div>
      </div>

      {/* Stats placeholder */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '0 24px',
        marginBottom: '20px',
      }}>
        <div style={{
          width: '108px',
          background: '#1c1c1c',
          borderRadius: '12px',
          padding: '14px',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Total views
          </div>
          <div style={{ fontSize: '30px', fontWeight: 700, color: '#fff' }}>0</div>
          <div style={{ fontSize: '9px', color: '#666' }}>No data yet</div>
        </div>
        <div style={{
          flex: 1,
          background: '#1c1c1c',
          borderRadius: '12px',
          padding: '14px',
        }}>
          <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Top clicks
          </div>
          <div style={{ fontSize: '13px', color: '#555', textAlign: 'center', paddingTop: '8px' }}>
            No data yet
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '0 24px',
        marginBottom: '20px',
      }}>
        <button style={{
          flex: 1,
          height: '44px',
          borderRadius: '12px',
          border: 'none',
          background: '#e91e8c',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          opacity: 0.5,
        }} disabled>
          Add Listing
        </button>
        <button style={{
          flex: 1,
          height: '44px',
          borderRadius: '12px',
          border: '1.5px solid #262626',
          background: 'transparent',
          color: '#e91e8c',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          opacity: profile.gifts_enabled ? 0.5 : 0.3,
        }} disabled>
          Add Wish
        </button>
      </div>

      {/* Navigation cards */}
      <div style={{ padding: '0 24px' }}>
        <NavCard label="Listings" subtitle="No listings yet" onClick={() => {}} />
        {profile.gifts_enabled && (
          <NavCard label="Wishlist" subtitle="No wishes yet" onClick={() => {}} />
        )}
        <NavCard label="Analytics" subtitle="Available after your first listing" onClick={() => {}} />
        <NavCard
          label="Settings"
          onClick={() => router.push('/model/settings')}
        />
      </div>

      {/* Copied toast */}
      {copied && (
        <div style={{
          position: 'fixed',
          top: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(28,28,28,0.95)',
          borderRadius: '10px',
          padding: '10px 20px',
          color: '#fff',
          fontSize: '13px',
          zIndex: 50,
        }}>
          Link copied
        </div>
      )}
    </div>
  )
}

function NavCard({
  label,
  subtitle,
  onClick,
}: {
  label: string
  subtitle?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        background: '#1c1c1c',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        marginBottom: '9px',
        textAlign: 'left',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>{label}</div>
        {subtitle && (
          <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{subtitle}</div>
        )}
      </div>
      <span style={{ color: '#555', fontSize: '14px' }}>&#8250;</span>
    </button>
  )
}
