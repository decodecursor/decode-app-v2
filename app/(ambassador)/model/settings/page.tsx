'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { isInternalEmail } from '@/lib/ambassador/auth'

interface Profile {
  id: string
  slug: string
  first_name: string
  last_name: string
  tagline: string | null
  instagram_handle: string
  currency: string
  cover_photo_url: string | null
  cover_photo_position_y: number
  is_published: boolean
  gifts_enabled: boolean
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userPhone, setUserPhone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Delete modal
  const [showDelete, setShowDelete] = useState(false)
  const [deleteStep, setDeleteStep] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Cover photo drag
  const [dragging, setDragging] = useState(false)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const dragStartY = useRef(0)
  const dragStartPos = useRef(50)
  const coverInputRef = useRef<HTMLInputElement>(null)

  // Load profile
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/model/auth'); return }

      // Get user metadata for display
      const email = user.email
      const phone = user.user_metadata?.phone_number
      if (email && !isInternalEmail(email)) {
        setUserEmail(email)
      }
      if (phone) setUserPhone(phone)

      const { data } = await supabase
        .from('model_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!data) { router.replace('/model/setup'); return }

      // instagram_handle lives on users, not model_profiles — fetch and merge
      const { data: userRow } = await supabase
        .from('users')
        .select('instagram_handle')
        .eq('id', user.id)
        .single()

      setProfile({ ...data, instagram_handle: userRow?.instagram_handle ?? '' } as Profile)
      setCoverPreview(data.cover_photo_url)
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  // Save a field
  const saveField = async (updates: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/ambassador/model/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (res.ok && data.profile) {
        setProfile(data.profile)
        showToast('Saved')
      } else {
        showToast(data.error || 'Failed to save')
      }
    } catch {
      showToast('Network error')
    }
    setSaving(false)
  }

  // Toggle handler
  const handleToggle = (field: string, currentValue: boolean) => {
    const newValue = !currentValue
    // Optimistic update
    setProfile(prev => prev ? { ...prev, [field]: newValue } : prev)
    saveField({
      [field === 'is_published' ? 'isPublished' : 'giftsEnabled']: newValue,
    })
  }

  // Cover drag handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!coverPreview) return
    setDragging(true)
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
    dragStartPos.current = profile?.cover_photo_position_y || 50
  }

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging) return
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const delta = clientY - dragStartY.current
    const newPos = Math.max(0, Math.min(100, dragStartPos.current + delta * 0.5))
    setProfile(prev => prev ? { ...prev, cover_photo_position_y: Math.round(newPos) } : prev)
  }, [dragging])

  const handleDragEnd = useCallback(() => {
    if (dragging && profile) {
      setDragging(false)
      saveField({ coverPhotoPositionY: profile.cover_photo_position_y })
    }
  }, [dragging, profile])

  useEffect(() => {
    if (dragging) {
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
    }
  }, [dragging, handleDragMove, handleDragEnd])

  // Cover photo upload
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverPreview(URL.createObjectURL(file))

    const formData = new FormData()
    formData.append('coverPhoto', file)
    formData.append('coverPhotoPositionY', '50')

    setSaving(true)
    try {
      const res = await fetch('/api/ambassador/model/settings', {
        method: 'PATCH',
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data.profile) {
        setProfile(data.profile)
        setCoverPreview(data.profile.cover_photo_url)
        showToast('Photo updated')
      }
    } catch {
      showToast('Upload failed')
    }
    setSaving(false)
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/model/auth')
  }

  // Delete
  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      const res = await fetch('/api/ambassador/model/settings', { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        router.replace('/model/auth')
      } else {
        showToast(data.error || 'Failed to delete')
        setDeleting(false)
      }
    } catch {
      showToast('Network error')
      setDeleting(false)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#000' }} />
  }

  if (!profile) return null

  const pageUrl = `welovedecode.com/${profile.slug}`

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 24px',
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          &#8592;
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>Settings</h1>
      </div>

      {/* Cover photo */}
      <div style={{ padding: '0 24px', marginBottom: '24px' }}>
        <div
          style={{
            height: '120px',
            borderRadius: '14px',
            background: coverPreview
              ? `url(${coverPreview}) center ${profile.cover_photo_position_y}% / cover no-repeat`
              : 'linear-gradient(135deg, #2a2a2a, #0a0a0a)',
            position: 'relative',
            overflow: 'hidden',
            cursor: coverPreview ? (dragging ? 'grabbing' : 'grab') : 'pointer',
          }}
          onClick={() => { if (!coverPreview) coverInputRef.current?.click() }}
          onMouseDown={coverPreview ? handleDragStart : undefined}
          onTouchStart={coverPreview ? handleDragStart : undefined}
        >
          <button
            onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click() }}
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid #333',
              color: '#fff',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            &#128247;
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleCoverChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* URL display */}
      <div style={{ padding: '0 24px', marginBottom: '24px' }}>
        <div style={{
          background: '#1c1c1c',
          borderRadius: '14px',
          border: '1px solid #262626',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '13px', color: '#888' }}>{pageUrl}</span>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(`https://${pageUrl}`)
              showToast('Link copied')
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '14px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ⎘
          </button>
        </div>
      </div>

      {/* Profile section */}
      <Section title="Profile">
        <EditableRow
          label="First name"
          value={profile.first_name}
          onSave={v => saveField({ firstName: v })}
        />
        <EditableRow
          label="Last name"
          value={profile.last_name}
          onSave={v => saveField({ lastName: v })}
        />
        <EditableRow
          label="Tagline"
          value={profile.tagline || ''}
          placeholder="Add a tagline..."
          onSave={v => saveField({ tagline: v })}
        />
        <EditableRow
          label="Instagram"
          value={profile.instagram_handle}
          onSave={v => saveField({ instagram: v })}
        />
      </Section>

      {/* Contact section */}
      <Section title="Contact">
        <Row label="Email" value={userEmail || 'Not set'} />
        <Row label="WhatsApp" value={userPhone || 'Not set'} />
      </Section>

      {/* Preferences section */}
      <Section title="Preferences">
        <div style={rowStyle}>
          <span style={{ color: '#888', fontSize: '14px' }}>Currency</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#fff', fontSize: '14px' }}>{profile.currency.toUpperCase()}</span>
            <span style={{ color: '#555', fontSize: '10px' }}>&#128274;</span>
          </div>
        </div>
        <ToggleRow
          label="Beauty Wishlist"
          description={profile.gifts_enabled ? 'Visible on your page' : 'Hidden from your page'}
          value={profile.gifts_enabled}
          onChange={() => handleToggle('gifts_enabled', profile.gifts_enabled)}
        />
        <ToggleRow
          label="Page live"
          description={profile.is_published ? 'Your page is visible' : 'Your page is hidden'}
          value={profile.is_published}
          onChange={() => handleToggle('is_published', profile.is_published)}
        />
      </Section>

      {/* Account section */}
      <Section title="Account">
        <button onClick={handleLogout} style={dangerRowStyle}>
          <span style={{ color: '#fff', fontSize: '14px' }}>Log out</span>
          <span style={{ color: '#555' }}>&#8250;</span>
        </button>
        <button onClick={() => { setShowDelete(true); setDeleteStep(1); setDeleteConfirm('') }} style={dangerRowStyle}>
          <span style={{ color: '#ef4444', fontSize: '14px' }}>Delete profile</span>
          <span style={{ color: '#555' }}>&#8250;</span>
        </button>
      </Section>

      {/* Toast */}
      {toast && (
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
          {toast}
        </div>
      )}

      {/* Delete modal */}
      {showDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '500px',
            background: '#1c1c1c',
            borderRadius: '20px 20px 0 0',
            padding: '24px 24px 32px',
          }}>
            {/* Drag handle */}
            <div style={{
              width: '40px',
              height: '4px',
              background: '#444',
              borderRadius: '2px',
              margin: '0 auto 20px',
            }} />

            {deleteStep === 1 && (
              <>
                <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
                  Delete your profile?
                </h2>
                <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.65, marginBottom: '24px' }}>
                  This will permanently delete your DECODE profile, listings, wishes, and analytics. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowDelete(false)}
                    style={{
                      flex: 1, height: '48px', borderRadius: '12px',
                      border: '1.5px solid #262626', background: 'transparent',
                      color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  >
                    Keep
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    style={{
                      flex: 1, height: '48px', borderRadius: '12px',
                      border: 'none', background: '#ef4444',
                      color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}

            {deleteStep === 2 && (
              <>
                <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
                  Type DELETE to confirm
                </h2>
                <input
                  type="text"
                  placeholder="DELETE"
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value.toUpperCase())}
                  autoFocus
                  style={{
                    width: '100%',
                    height: '52px',
                    padding: '0 16px',
                    background: 'transparent',
                    border: '1.5px solid #262626',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '16px',
                    textAlign: 'center',
                    letterSpacing: '2px',
                    outline: 'none',
                    marginBottom: '16px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setShowDelete(false); setDeleteStep(1) }}
                    style={{
                      flex: 1, height: '48px', borderRadius: '12px',
                      border: '1.5px solid #262626', background: 'transparent',
                      color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteConfirm !== 'DELETE' || deleting}
                    style={{
                      flex: 1, height: '48px', borderRadius: '12px',
                      border: 'none',
                      background: deleteConfirm === 'DELETE' ? '#ef4444' : '#333',
                      color: deleteConfirm === 'DELETE' ? '#fff' : '#555',
                      fontSize: '14px', fontWeight: 600,
                      cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  >
                    {deleting ? 'Deleting...' : 'Confirm delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '0 24px', marginBottom: '24px' }}>
      <div style={{
        fontSize: '9px',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        color: '#666',
        marginBottom: '8px',
      }}>
        {title}
      </div>
      <div style={{
        background: '#1c1c1c',
        borderRadius: '12px',
        border: '1px solid #262626',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowStyle}>
      <span style={{ color: '#888', fontSize: '14px' }}>{label}</span>
      <span style={{ color: '#fff', fontSize: '14px' }}>{value}</span>
    </div>
  )
}

function EditableRow({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string
  value: string
  placeholder?: string
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleSave = () => {
    if (draft.trim() !== value) {
      onSave(draft.trim())
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ ...rowStyle, padding: '8px 16px' }}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '14px',
            outline: 'none',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      style={{
        ...rowStyle,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <span style={{ color: '#888', fontSize: '14px' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: value ? '#fff' : '#555', fontSize: '14px' }}>
          {value || placeholder || 'Add...'}
        </span>
        <span style={{ color: '#555', fontSize: '12px' }}>&#8250;</span>
      </div>
    </button>
  )
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: boolean
  onChange: () => void
}) {
  return (
    <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontSize: '14px' }}>{label}</span>
        <button
          onClick={onChange}
          style={{
            width: '44px',
            height: '24px',
            borderRadius: '12px',
            border: 'none',
            background: value ? '#e91e8c' : '#333',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: '2px',
            left: value ? '22px' : '2px',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>
      <span style={{
        fontSize: '11px',
        color: value ? '#888' : '#ef4444',
      }}>
        {description}
      </span>
    </div>
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: '1px solid #262626',
}

const dangerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: '1px solid #262626',
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBlockEnd: '1px solid #262626',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'system-ui, -apple-system, sans-serif',
}
