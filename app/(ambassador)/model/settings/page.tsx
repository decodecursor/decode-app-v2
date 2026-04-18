'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { isInternalEmail } from '@/lib/ambassador/auth'
import { CoverCameraButton } from '@/components/ambassador/CoverCameraButton'

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

const AedSvg = () => (
  <svg
    width="11"
    height="10"
    viewBox="0 0 344.84 299.91"
    fill="#fff"
    style={{ verticalAlign: '-1px', margin: '0 1px' }}
  >
    <path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z" />
  </svg>
)

const CURRENCY_SYMBOLS: Record<string, React.ReactNode> = {
  USD: <span>$</span>,
  EUR: <span>€</span>,
  GBP: <span>£</span>,
  AED: <AedSvg />,
}

const urlIconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: '#111',
  border: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  position: 'relative',
}

const rowStyle: React.CSSProperties = {
  padding: '14px 16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const cardStyle: React.CSSProperties = {
  background: '#1c1c1c',
  borderRadius: 14,
  overflow: 'hidden',
  marginBottom: 12,
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userPhone, setUserPhone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)

  // Delete modal
  const [showDelete, setShowDelete] = useState(false)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Cover photo drag
  const [dragging, setDragging] = useState(false)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const dragStartY = useRef(0)
  const dragStartPos = useRef(50)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/model/auth'); return }

      const email = user.email
      const phone = user.user_metadata?.phone_number
      if (email && !isInternalEmail(email)) setUserEmail(email)
      if (phone) setUserPhone(phone)

      const { data } = await supabase
        .from('model_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!data) { router.replace('/model/setup'); return }

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
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1800)
  }

  const saveField = async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/ambassador/model/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (res.ok && data.profile) {
        setProfile(data.profile)
      } else {
        showToast(data.error || 'Failed to save')
      }
    } catch {
      showToast('Network error')
    }
  }

  const handleToggle = (field: 'is_published' | 'gifts_enabled') => {
    if (!profile) return
    const newValue = !profile[field]
    setProfile({ ...profile, [field]: newValue })
    saveField({ [field === 'is_published' ? 'isPublished' : 'giftsEnabled']: newValue })
  }

  // Cover drag
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!coverPreview || !profile) return
    setDragging(true)
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
    dragStartPos.current = profile.cover_photo_position_y || 50
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

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverPreview(URL.createObjectURL(file))

    const formData = new FormData()
    formData.append('coverPhoto', file)
    formData.append('coverPhotoPositionY', '50')

    try {
      const res = await fetch('/api/ambassador/model/settings', {
        method: 'PATCH',
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data.profile) {
        setProfile(data.profile)
        setCoverPreview(data.profile.cover_photo_url)
      }
    } catch {
      showToast('Upload failed')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/model/auth')
  }

  const handleDelete = async () => {
    if (deleteConfirm.toUpperCase() !== 'DELETE') return
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

  const handleCopy = async () => {
    if (!profile) return
    try {
      await navigator.clipboard.writeText(`https://welovedecode.com/${profile.slug}`)
    } catch { /* clipboard unavailable */ }
    setCopied(true)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 1500)
  }

  const openPublic = () => {
    if (!profile) return
    window.open(`https://welovedecode.com/${profile.slug}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#000' }} />
  if (!profile) return null

  const slug = profile.slug
  const currencyCode = (profile.currency || '').toUpperCase()
  const currencySymbol = CURRENCY_SYMBOLS[currencyCode]

  return (
    <div style={{ padding: '16px 20px 24px', position: 'relative' }}>
      {/* Header */}
      <div style={{ padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg
          onClick={() => router.back()}
          width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ cursor: 'pointer' }}
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Settings</span>
      </div>

      {/* Cover */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleCoverChange}
        style={{ display: 'none' }}
      />
      <div
        onMouseDown={coverPreview ? handleDragStart : undefined}
        onTouchStart={coverPreview ? handleDragStart : undefined}
        onClick={() => { if (!coverPreview) coverInputRef.current?.click() }}
        style={{
          position: 'relative',
          height: 120,
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 16,
          backgroundImage: coverPreview
            ? `url(${coverPreview})`
            : 'linear-gradient(135deg,#2a2a2a 0%,#0a0a0a 100%)',
          backgroundSize: 'cover',
          backgroundPosition: `center ${profile.cover_photo_position_y}%`,
          backgroundRepeat: 'no-repeat',
          userSelect: 'none',
          touchAction: 'none',
          cursor: coverPreview ? (dragging ? 'grabbing' : 'grab') : 'pointer',
        }}
      >
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: 50,
          background: 'linear-gradient(transparent,rgba(0,0,0,0.6))',
          pointerEvents: 'none',
        }} />
        <CoverCameraButton
          size={34}
          onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click() }}
        />
      </div>

      {/* URL card */}
      <div style={{
        background: '#1c1c1c',
        borderRadius: 14,
        padding: '13px 14px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        border: '1px solid #262626',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 3 }}>Your page</div>
          <div style={{
            fontSize: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            <span style={{ color: '#666' }}>welovedecode.com/</span>
            <span style={{ color: '#fff', fontWeight: 500 }}>{slug}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={handleCopy} style={urlIconBtnStyle} title="Copy URL">
            {copied && (
              <span style={{
                position: 'absolute',
                top: -18,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 10,
                fontWeight: 500,
                color: '#4ade80',
                letterSpacing: 0.3,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}>Copied!</span>
            )}
            {copied ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <button onClick={openPublic} style={urlIconBtnStyle} title="View page">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
          {/* TODO(slice-5): 3-step URL edit modal per settings.html:82-128 */}
          <button
            onClick={() => showToast('URL editing coming soon')}
            style={urlIconBtnStyle}
            title="Edit URL"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Profile */}
      <div style={cardStyle}>
        <EditableRow label="First name" value={profile.first_name} onSave={(v) => saveField({ firstName: v })} isLast={false} />
        <EditableRow label="Last name" value={profile.last_name} onSave={(v) => saveField({ lastName: v })} isLast={false} />
        <EditableRow label="Tagline" value={profile.tagline || ''} onSave={(v) => saveField({ tagline: v })} isLast={false} placeholder="Add a tagline…" />
        <EditableRow label="Instagram" value={profile.instagram_handle} onSave={(v) => saveField({ instagram: v })} isLast={true} instagram />
      </div>

      {/* Contact */}
      <div style={cardStyle}>
        {/* TODO(slice-5): email modal — supabase.auth.updateUser({ email }) */}
        <div
          onClick={() => showToast('Email editing coming soon')}
          style={{ ...rowStyle, borderBottom: '1px solid #262626', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 14, color: '#888' }}>Email</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, color: '#fff' }}>{userEmail || 'Not set'}</span>
            <Chevron />
          </div>
        </div>
        {/* TODO(slice-5): phone modal — AUTHKey send + verify + UPDATE users.phone */}
        <div
          onClick={() => showToast('WhatsApp editing coming soon')}
          style={{ ...rowStyle, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 14, color: '#888' }}>WhatsApp</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, color: '#fff' }}>{userPhone || 'Not set'}</span>
            <Chevron />
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div style={cardStyle}>
        <div style={{ ...rowStyle, borderBottom: '1px solid #262626' }}>
          <div>
            <span style={{ fontSize: 14, color: '#888' }}>Currency</span>
            <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>Can&apos;t be changed after setup</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{
              fontSize: 14, color: '#fff', lineHeight: 1, whiteSpace: 'nowrap',
            }}>
              {currencyCode}{currencySymbol ? <> (<span style={{ display: 'inline-flex', alignItems: 'center' }}>{currencySymbol}</span>)</> : null}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" style={{ display: 'block', flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>
        <ToggleRow
          label="Beauty Wishlist"
          description={profile.gifts_enabled ? 'Visible on your page' : 'Hidden from your page'}
          value={profile.gifts_enabled}
          onChange={() => handleToggle('gifts_enabled')}
          borderBottom
        />
        <ToggleRow
          label="Page live"
          description={profile.is_published ? 'Your page is visible' : 'Your page is hidden'}
          value={profile.is_published}
          onChange={() => handleToggle('is_published')}
        />
      </div>

      {/* Account */}
      <div style={cardStyle}>
        <div
          onClick={handleLogout}
          style={{ ...rowStyle, borderBottom: '1px solid #262626', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 14, color: '#888' }}>Log out</span>
          <Chevron />
        </div>
        <div
          onClick={() => { setShowDelete(true); setDeleteStep(1); setDeleteConfirm('') }}
          style={{ ...rowStyle, cursor: 'pointer' }}
        >
          <span style={{ fontSize: 14, color: '#888' }}>Delete profile</span>
          <Chevron />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1c1c1c',
          border: '1px solid #333',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: 24,
          fontSize: 12,
          zIndex: 30,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          {toast}
        </div>
      )}

      {/* Delete modal */}
      {showDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            background: '#1c1c1c',
            borderRadius: '20px 20px 0 0',
            width: '100%',
            maxWidth: 500,
            padding: '24px 20px 32px',
          }}>
            <div style={{ width: 40, height: 4, background: '#444', borderRadius: 2, margin: '0 auto 24px' }} />
            {deleteStep === 1 && (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
                  Delete profile?
                </div>
                <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
                  This will permanently remove your page and all its content.
                </div>
                <div style={{ background: '#111', borderRadius: 10, padding: 16, marginBottom: 24 }}>
                  {[
                    'Your public page will be deleted',
                    'All listings will be removed',
                    'Your URL will be released',
                    'This action cannot be undone',
                  ].map((text, i, arr) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i === arr.length - 1 ? 0 : 12 }}>
                      <span style={{ fontSize: 12, color: '#ef4444' }}>&#10006;</span>
                      <span style={{ fontSize: 13, color: '#888' }}>{text}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div
                    onClick={() => setShowDelete(false)}
                    style={{
                      flex: 1, background: '#262626', borderRadius: 12, padding: 16,
                      textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff',
                    }}
                  >
                    Keep
                  </div>
                  <div
                    onClick={() => setDeleteStep(2)}
                    style={{
                      flex: 1, background: '#ef4444', borderRadius: 12, padding: 16,
                      textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff',
                    }}
                  >
                    Delete
                  </div>
                </div>
              </>
            )}
            {deleteStep === 2 && (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8, color: '#fff' }}>
                  Final step
                </div>
                <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
                  Type <span style={{ color: '#fff', fontWeight: 700 }}>DELETE</span> below to confirm.
                </div>
                <div style={{ background: '#111', borderRadius: 10, padding: '0 16px', marginBottom: 24 }}>
                  <input
                    type="text"
                    placeholder="DELETE"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())}
                    autoFocus
                    autoCapitalize="characters"
                    autoComplete="off"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      fontSize: 14,
                      color: '#fff',
                      padding: '16px 0',
                      textAlign: 'center',
                      letterSpacing: 1,
                      caretColor: '#ef4444',
                      textTransform: 'uppercase',
                      outline: 'none',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div
                    onClick={() => { setShowDelete(false); setDeleteStep(1) }}
                    style={{
                      flex: 1, background: '#262626', borderRadius: 12, padding: 16,
                      textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff',
                    }}
                  >
                    Keep
                  </div>
                  <div
                    onClick={handleDelete}
                    style={{
                      flex: 1,
                      background: deleteConfirm.toUpperCase() === 'DELETE' ? '#ef4444' : '#333',
                      color: deleteConfirm.toUpperCase() === 'DELETE' ? '#fff' : '#666',
                      borderRadius: 12,
                      padding: 16,
                      textAlign: 'center',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: deleteConfirm.toUpperCase() === 'DELETE' ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function EditableRow({
  label,
  value,
  placeholder,
  onSave,
  isLast,
  instagram,
}: {
  label: string
  value: string
  placeholder?: string
  onSave: (v: string) => void
  isLast: boolean
  instagram?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [flash, setFlash] = useState(false)

  const normalize = (v: string) => {
    if (!instagram) return v.trim().slice(0, 70)
    const cleaned = v
      .replace(/^@/, '')
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/\/$/, '')
      .trim()
    return cleaned.slice(0, 70)
  }

  const handleSave = () => {
    const nv = normalize(draft)
    if (nv && nv !== value) {
      onSave(nv)
      setFlash(true)
      setTimeout(() => setFlash(false), 1200)
    }
    setEditing(false)
  }

  const displayValue = value || placeholder || ''
  const displayColor = value ? '#fff' : '#555'

  return (
    <div
      onClick={() => { if (!editing) { setDraft(value); setEditing(true) } }}
      style={{
        ...rowStyle,
        borderBottom: isLast ? 'none' : '1px solid #262626',
        cursor: editing ? 'default' : 'pointer',
        background: flash ? '#14532d' : '#1c1c1c',
        transition: flash ? 'background 1.2s ease-out' : undefined,
      }}
    >
      <span style={{ fontSize: 14, color: '#888' }}>{label}</span>
      {editing ? (
        <input
          autoFocus
          value={draft}
          maxLength={70}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') { setDraft(value); setEditing(false) }
          }}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            fontSize: 14,
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            flex: 1,
            minWidth: 0,
            textAlign: 'right',
            caretColor: '#e91e8c',
            marginLeft: 12,
          }}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 14,
            color: displayColor,
            maxWidth: 170,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayValue}
          </span>
          <Chevron />
        </div>
      )}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  borderBottom,
}: {
  label: string
  description: string
  value: boolean
  onChange: () => void
  borderBottom?: boolean
}) {
  return (
    <div style={{ ...rowStyle, borderBottom: borderBottom ? '1px solid #262626' : 'none' }}>
      <div>
        <span style={{ fontSize: 14, color: '#888' }}>{label}</span>
        <div style={{ fontSize: 10, color: '#e91e8c', marginTop: 3 }}>{description}</div>
      </div>
      <div
        onClick={onChange}
        style={{
          width: 44,
          height: 24,
          background: value ? '#e91e8c' : '#333',
          borderRadius: 12,
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
      >
        <div style={{
          width: 20,
          height: 20,
          background: '#fff',
          borderRadius: '50%',
          position: 'absolute',
          top: 2,
          left: value ? 22 : 2,
          transition: 'left 0.2s',
        }} />
      </div>
    </div>
  )
}
