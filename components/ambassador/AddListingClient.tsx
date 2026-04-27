'use client'

/**
 * Add Listing form (client).
 *
 * Slice 3B Phase 5 Commit B — full wiring:
 *   - Avatar upload via <ImageCropper mode="avatar"> → client-side direct
 *     upload to model-media bucket under {uid}/professionals/avatars/.
 *   - Listing photo uploads (×1-3) via <ImageCropper mode="listing"> →
 *     client-side direct upload to {uid}/listings/photos/.
 *   - Video uploads with client-side validation (≤15s duration, ≤15MB
 *     size, MP4/MOV/WebM MIME) → {uid}/listings/videos/. HEVC accepted
 *     silently per Phase 1 #13.
 *   - Instagram handle dedup on blur (when form has enough to attempt a
 *     full create) → auto-swap name/city/country from existing row.
 *   - Submit: resolve professional (dedup-or-create), POST listing,
 *     redirect to /model/listings?new={id}&type=trial|paid. Celebration
 *     toast fires on the listings page from the ?new flag.
 *
 * UX spec: `_features/ambassador/add_listing_final_UI_Spec.md`
 * Mockup:  `_features/ambassador/add_listing_final.html`
 *
 * Uploads go client-side via the authenticated Supabase browser client.
 * RLS on the model-media INSERT policy enforces that {auth.uid()}/... is
 * the only writable path, so a client can't upload to another user's
 * folder. Matches cover-upload semantics without needing a new server
 * proxy route (Principle E — preserve the shape, not the channel).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AmbSubmitButton } from '@/components/ambassador/AmbSubmitButton'
import BackArrow from '@/components/ambassador/BackArrow'
import { ImageCropper } from '@/components/ambassador/ImageCropper'
import { createClient } from '@/utils/supabase/client'
import {
  capFirst,
  currencySymbol,
  priceFloorForCurrency,
  normalizeInstagram,
  buildAvatarPath,
  buildListingPhotoPath,
  buildListingVideoPath,
  validateVideoFile,
  PriceBox,
} from '@/lib/ambassador/add-listing-helpers'

type Category = { id: string; label: string; slug: string }

// Prefill shapes — required when mode='edit', optional otherwise.
// professional mirrors the model_professionals row joined through the
// listing's professional_id FK. listing carries the editable fields plus
// is_free_trial (drives pricing lock) and status.
type Professional = {
  id: string
  instagram_handle: string
  name: string
  city: string
  country: string
  avatar_photo_url: string
}

type ListingPrefill = {
  id: string
  is_free_trial: boolean
  status: string
  category_id: string | null
  category_custom: string | null
  media_type: 'video' | 'photos' | null
  video_url: string | null
  photo_url_1: string | null
  photo_url_2: string | null
  photo_url_3: string | null
  price_30: number | null
  price_60: number | null
  price_90: number | null
}

interface Props {
  categories: Category[]
  currency: string
  profileId: string
  mode?: 'create' | 'edit'
  listing?: ListingPrefill
  professional?: Professional
}

type CategorySelection =
  | { type: 'id'; id: string; label: string }
  | { type: 'custom'; text: string }
  | null

type Media =
  | { kind: 'photos'; urls: string[] }
  | { kind: 'video'; url: string; previewUrl: string }
  | null

type ToastPayload = { emoji?: string; message: string }

// Module-private constants used only by this component's state machine.
// priceFloorForCurrency / currencySymbol / video-related constants live in
// lib/ambassador/add-listing-helpers.tsx.
const MODEL_MEDIA_BUCKET = 'model-media'
const TOAST_LIFECYCLE_MS = 5200

// --- Styling constants (kept local, match canonical ambassador forms) ---

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 9,
  color: '#666',
  fontWeight: 400,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 12,
  paddingLeft: 4,
}

const INPUT_BASE: React.CSSProperties = {
  width: '100%',
  background: '#1c1c1c',
  border: '1.5px solid #262626',
  borderRadius: 12,
  padding: '14px 16px',
  fontSize: 14,
  color: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const FOCUS_SCOPE_ID = 'add-listing-page'

export default function AddListingClient({
  categories,
  currency,
  profileId: _profileId,
  mode = 'create',
  listing,
  professional,
}: Props) {
  const isEdit = mode === 'edit'
  const router = useRouter()
  // Stable browser Supabase client — one per component mount.
  const supabase = useMemo(() => createClient(), [])
  // Current auth user id (for storage path scoping). Captured client-side
  // on mount — the server component already redirected unauthed users, so
  // this should always resolve to a valid UUID shortly after mount.
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) setUserId(data.user.id)
    })
    return () => { cancelled = true }
  }, [supabase])

  // --- Text form state ---
  // In edit mode, professional fields (name/city/country/instagram) are
  // prefilled from the joined model_professionals row and rendered locked
  // (per Slice 3C locked decision #2 — identity immutable). In create mode
  // these are empty and editable. Lazy initializers run exactly once at
  // mount so the prefill check happens without re-evaluation.
  const [name, setName] = useState(() => (isEdit && professional ? professional.name : ''))
  const [city, setCity] = useState(() => (isEdit && professional ? professional.city : ''))
  const [country, setCountry] = useState(() => (isEdit && professional ? professional.country : ''))
  const [instagram, setInstagram] = useState(() => (isEdit && professional ? professional.instagram_handle : ''))
  const [category, setCategory] = useState<CategorySelection>(() => {
    if (isEdit && listing) {
      if (listing.category_id) {
        const found = categories.find((c) => c.id === listing.category_id)
        if (found) return { type: 'id', id: found.id, label: found.label }
      }
      if (listing.category_custom) return { type: 'custom', text: listing.category_custom }
    }
    return null
  })
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [customCategoryText, setCustomCategoryText] = useState(() =>
    isEdit && listing?.category_custom ? listing.category_custom : '',
  )
  const [showCustomInput, setShowCustomInput] = useState(() =>
    !!(isEdit && listing?.category_custom),
  )

  const [p30, setP30] = useState(() =>
    isEdit && listing?.price_30 != null ? String(listing.price_30) : '',
  )
  const [p60, setP60] = useState(() =>
    isEdit && listing?.price_60 != null ? String(listing.price_60) : '',
  )
  const [p90, setP90] = useState(() =>
    isEdit && listing?.price_90 != null ? String(listing.price_90) : '',
  )
  const [touched30, setTouched30] = useState(false)
  const [touched60, setTouched60] = useState(false)
  const [touched90, setTouched90] = useState(false)

  // is_free_trial is immutable in edit mode (locked decision #2). Prefill
  // matches the existing row; toggle is disabled below.
  const [freeTrial, setFreeTrial] = useState(() => (isEdit && listing ? listing.is_free_trial : false))

  // --- Upload state ---
  const [avatarCropperFile, setAvatarCropperFile] = useState<File | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() =>
    isEdit && professional ? professional.avatar_photo_url : null,
  )
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const [mediaCropperFile, setMediaCropperFile] = useState<File | null>(null)
  const [media, setMedia] = useState<Media>(() => {
    if (isEdit && listing) {
      if (listing.media_type === 'video' && listing.video_url) {
        // previewUrl = the public URL; <video src> plays it directly. No
        // local createObjectURL lifecycle in edit mode — the file lives
        // in storage already.
        return { kind: 'video', url: listing.video_url, previewUrl: listing.video_url }
      }
      if (listing.media_type === 'photos' && listing.photo_url_1) {
        const urls = [listing.photo_url_1, listing.photo_url_2, listing.photo_url_3].filter(Boolean) as string[]
        return { kind: 'photos', urls }
      }
    }
    return null
  })
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  // --- Dedup state ---
  // In create mode, professionalId + professionalLocked are set by the
  // blur-dedup auto-swap path. In edit mode they're seeded from the
  // joined professional and never mutate (IG handle is locked — no
  // re-resolve path exists).
  const [professionalId, setProfessionalId] = useState<string | null>(() =>
    isEdit && professional ? professional.id : null,
  )
  const [professionalLocked, setProfessionalLocked] = useState(() => isEdit)
  const [dedupInFlight, setDedupInFlight] = useState(false)
  const lastProbedIgRef = useRef<string>('')

  // --- Toast state (canonical amb-toast-in/out animation) ---
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const [toastKey, setToastKey] = useState(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  const showToast = useCallback((payload: ToastPayload) => {
    setToast(payload)
    setToastKey((k) => k + 1)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_LIFECYCLE_MS)
  }, [])

  // --- Hidden file inputs ---
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const mediaInputRef = useRef<HTMLInputElement | null>(null)

  // --- Close category dropdown on outside click ---
  const catRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!categoryOpen) return
    const onClick = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCategoryOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [categoryOpen])

  const selectCategory = (cat: Category) => {
    setCategory({ type: 'id', id: cat.id, label: cat.label })
    setShowCustomInput(false)
    setCustomCategoryText('')
    setCategoryOpen(false)
  }
  const selectCustom = () => {
    setShowCustomInput(true)
    setCategory({ type: 'custom', text: '' })
    setCategoryOpen(false)
  }
  const onCustomCategoryChange = (v: string) => {
    const capped = capFirst(v)
    setCustomCategoryText(capped)
    setCategory({ type: 'custom', text: capped })
  }

  // ---- Upload helper (client-side direct to Supabase Storage) ----
  const uploadBlob = useCallback(async (blob: Blob, path: string, contentType: string): Promise<string> => {
    const { error } = await supabase.storage
      .from(MODEL_MEDIA_BUCKET)
      .upload(path, blob, { contentType, cacheControl: '3600', upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from(MODEL_MEDIA_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }, [supabase])

  // ---- Avatar flow ----
  const openAvatarPicker = () => {
    if (professionalLocked) return // existing professional — avatar is snapshot
    avatarInputRef.current?.click()
  }
  const onAvatarFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAvatarError(null)
    setAvatarCropperFile(file)
  }
  const onAvatarCropComplete = async (blob: Blob) => {
    setAvatarCropperFile(null)
    if (!userId) return
    setUploadingAvatar(true)
    setAvatarError(null)
    try {
      const path = buildAvatarPath(userId)
      const url = await uploadBlob(blob, path, 'image/jpeg')
      setAvatarUrl(url)
    } catch (err) {
      console.error('[AddListing] Avatar upload failed:', err)
      setAvatarError('Upload failed. Try again.')
    } finally {
      setUploadingAvatar(false)
    }
  }
  const onAvatarCropCancel = () => setAvatarCropperFile(null)
  const removeAvatar = () => {
    if (professionalLocked) return
    setAvatarUrl(null)
    setAvatarError(null)
  }

  // ---- Media flow ----
  const openMediaPicker = () => {
    mediaInputRef.current?.click()
  }
  const onMediaFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMediaError(null)

    if (file.type.startsWith('image/')) {
      // Photos path. If a video is already present, refuse.
      if (media?.kind === 'video') {
        setMediaError('Remove the video first to upload photos.')
        return
      }
      if (media?.kind === 'photos' && media.urls.length >= 3) {
        setMediaError("Can't add more than 3 photos.")
        return
      }
      setMediaCropperFile(file)
      return
    }

    if (file.type.startsWith('video/')) {
      // Video path. If photos are already present, refuse.
      if (media?.kind === 'photos' && media.urls.length > 0) {
        setMediaError('Remove the photos first to upload a video.')
        return
      }
      if (!userId) return
      setUploadingMedia(true)
      const v = await validateVideoFile(file)
      if (v.ok === false) {
        setMediaError(v.error)
        setUploadingMedia(false)
        return
      }
      try {
        const path = buildListingVideoPath(userId, file.type)
        const url = await uploadBlob(file, path, file.type)
        const previewUrl = URL.createObjectURL(file)
        setMedia({ kind: 'video', url, previewUrl })
      } catch (err) {
        console.error('[AddListing] Video upload failed:', err)
        setMediaError('Upload failed. Try again.')
      } finally {
        setUploadingMedia(false)
      }
      return
    }

    setMediaError('Unsupported file type.')
  }
  const onMediaCropComplete = async (blob: Blob) => {
    setMediaCropperFile(null)
    if (!userId) return
    setUploadingMedia(true)
    setMediaError(null)
    try {
      const path = buildListingPhotoPath(userId)
      const url = await uploadBlob(blob, path, 'image/jpeg')
      setMedia((prev) => {
        if (prev?.kind === 'video') return prev // defensive; state transition blocked above
        const existing = prev?.kind === 'photos' ? prev.urls : []
        return { kind: 'photos', urls: [...existing, url].slice(0, 3) }
      })
    } catch (err) {
      console.error('[AddListing] Photo upload failed:', err)
      setMediaError('Upload failed. Try again.')
    } finally {
      setUploadingMedia(false)
    }
  }
  const onMediaCropCancel = () => setMediaCropperFile(null)
  const removeMediaPhoto = (idx: number) => {
    setMedia((prev) => {
      if (prev?.kind !== 'photos') return prev
      const next = prev.urls.filter((_, i) => i !== idx)
      return next.length === 0 ? null : { kind: 'photos', urls: next }
    })
  }
  const removeMediaVideo = () => {
    setMedia((prev) => {
      if (prev?.kind === 'video') URL.revokeObjectURL(prev.previewUrl)
      return null
    })
  }

  // ---- Instagram dedup on blur ----
  // Fire-and-forget probe. If the handle matches an existing professional,
  // auto-swap name/city/country and lock those fields. If the handle is
  // new, the server may 400 on missing fields (avatar not yet uploaded,
  // etc.) — we ignore those silently and defer dedup to submit time.
  const onInstagramBlur = async () => {
    const normalized = normalizeInstagram(instagram)
    if (!normalized) return
    if (normalized === lastProbedIgRef.current) return
    lastProbedIgRef.current = normalized

    setDedupInFlight(true)
    try {
      const res = await fetch('/api/ambassador/model/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram_handle: normalized,
          // Pass whatever we currently have. Server only requires the full
          // set when no existing row matches. The match path succeeds
          // regardless of completeness.
          name,
          city,
          country,
          avatar_photo_url: avatarUrl,
        }),
      })
      if (!res.ok) return // 400 on missing fields for new row — defer to submit
      const data = await res.json() as { professional: { id: string; name: string; city: string; country: string; avatar_photo_url: string }; created: boolean }
      if (!data.created) {
        // Existing professional — auto-swap and lock
        setName(data.professional.name)
        setCity(data.professional.city)
        setCountry(data.professional.country)
        setAvatarUrl(data.professional.avatar_photo_url)
        setProfessionalId(data.professional.id)
        setProfessionalLocked(true)
        showToast({ emoji: '🔄', message: `Using existing ${data.professional.name}` })
      } else {
        // Server created a new row from what we had. Capture the id.
        setProfessionalId(data.professional.id)
      }
    } catch (err) {
      console.error('[AddListing] Dedup probe failed:', err)
      // Silent — re-resolved on submit
    } finally {
      setDedupInFlight(false)
    }
  }

  // User is editing IG post-lock → unlock and clear the resolved id
  const onInstagramChange = (v: string) => {
    const next = v.replace(/[^a-zA-Z0-9._]/g, '')
    setInstagram(next)
    if (professionalLocked) {
      setProfessionalLocked(false)
      setProfessionalId(null)
      lastProbedIgRef.current = ''
    }
  }

  // --- Pricing derived values ---
  const p30n = parseInt(p30, 10) || 0
  const p60n = parseInt(p60, 10) || 0
  const p90n = parseInt(p90, 10) || 0
  const floor = priceFloorForCurrency(currency)
  const symbol = currencySymbol(currency)

  const perDay30 = p30n > 0 ? (p30n / 30).toFixed(2) : ''
  const perDay60 = p60n > 0 ? (p60n / 60).toFixed(2) : ''
  const perDay90 = p90n > 0 ? (p90n / 90).toFixed(2) : ''

  const offPct = (amount: number, days: number) => {
    if (p30n <= 0 || amount <= 0) return null
    const per = amount / days
    const per30 = p30n / 30
    if (per >= per30) return null
    return Math.round((per30 - per) / per30 * 100)
  }
  const off60 = p60n > p30n ? offPct(p60n, 60) : null
  const off90 = p90n > p60n ? offPct(p90n, 90) : null

  const min30 = touched30 && p30n > 0 && p30n < floor
  const min60 = touched60 && p60n > 0 && p60n < floor
  const min90 = touched90 && p90n > 0 && p90n < floor
  const err30 = touched30 && p30 === '0'
  const err60 = touched60 && (p60 === '0' || (p60n > 0 && p30n > 0 && p60n <= p30n))
  const err90 = touched90 && (p90 === '0' || (p90n > 0 && p60n > 0 && p90n <= p60n))
  const box30Bad = err30 || min30
  const box60Bad = err60 || min60
  const box90Bad = err90 || min90

  const pricingError = useMemo(() => {
    if (min30 || min60 || min90) return `Minimum ${symbol} ${floor}`
    if (err30) return 'Price must be greater than 0'
    if (err60 && p60 === '0') return 'Price must be greater than 0'
    if (err90 && p90 === '0') return 'Price must be greater than 0'
    if (err60) return '60-day price must be higher than 30-day'
    if (err90) return '90-day price must be higher than 60-day'
    return ''
  }, [min30, min60, min90, err30, err60, err90, p60, p90, symbol, floor])

  // --- Form validity ---
  const pricingValid = freeTrial || (
    p30n >= floor && p60n >= floor && p90n >= floor && p30n < p60n && p60n < p90n
  )
  const categoryValid = !!category && (category.type === 'id' || category.text.trim().length >= 2)
  const allUploadsDone = !!avatarUrl && !!media && !uploadingAvatar && !uploadingMedia
  const textFieldsValid =
    name.trim().length >= 2 &&
    city.trim().length >= 2 &&
    country.trim().length >= 2 &&
    instagram.trim().length >= 1
  const isValid = textFieldsValid && categoryValid && allUploadsDone && pricingValid
  const isUploading = uploadingAvatar || uploadingMedia
  const submitIdleLabel = isUploading
    ? 'Uploading…'
    : isEdit ? 'Save changes' : 'Create listing'

  // ---- Submit handler ----
  const handleSubmit = useCallback(async () => {
    if (!isValid) throw new Error('form invalid')

    // Force validation on all pricing fields (catches never-blurred paths)
    if (!freeTrial) {
      setTouched30(true); setTouched60(true); setTouched90(true)
      if (!pricingValid) throw new Error('pricing invalid')
    }

    // --- Edit mode: PATCH path, skip dedup entirely ---
    // Professional is locked per Slice 3C locked decision #2 — IG handle
    // + professional fields are immutable in edit. Only category / media /
    // pricing mutate. PATCH rejects non-editable fields server-side; we
    // only send what's editable.
    if (isEdit && listing) {
      const patchPayload: Record<string, unknown> = {
        category_id: category?.type === 'id' ? category.id : null,
        category_custom: category?.type === 'custom' ? category.text : null,
        media_type: media!.kind === 'photos' ? 'photos' : 'video',
        video_url: media!.kind === 'video' ? media!.url : null,
        photo_url_1: media!.kind === 'photos' ? media!.urls[0] ?? null : null,
        photo_url_2: media!.kind === 'photos' ? media!.urls[1] ?? null : null,
        photo_url_3: media!.kind === 'photos' ? media!.urls[2] ?? null : null,
        price_30: freeTrial ? null : p30n,
        price_60: freeTrial ? null : p60n,
        price_90: freeTrial ? null : p90n,
      }
      const patchRes = await fetch(`/api/ambassador/model/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      })
      if (!patchRes.ok) {
        showToast({ emoji: '📡', message: 'Couldn’t reach server. Try again.' })
        throw new Error('listings PATCH failed')
      }
      router.push(`/model/listings?updated=${listing.id}`)
      return
    }

    // --- Create mode: dedup professional, POST listing, redirect ---
    // 1. Resolve professional (if not already resolved via blur-dedup)
    let pid = professionalId
    if (!pid) {
      const res = await fetch('/api/ambassador/model/professionals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram_handle: normalizeInstagram(instagram),
          name,
          city,
          country,
          avatar_photo_url: avatarUrl,
        }),
      })
      if (!res.ok) {
        showToast({ emoji: '📡', message: 'Couldn’t reach server. Try again.' })
        throw new Error('professionals POST failed')
      }
      const data = await res.json() as { professional: { id: string }; created: boolean }
      pid = data.professional.id
      setProfessionalId(pid)
    }

    // 2. Build listing payload
    const payload: Record<string, unknown> = {
      professional_id: pid,
      category_id: category?.type === 'id' ? category.id : null,
      category_custom: category?.type === 'custom' ? category.text : null,
      media_type: media!.kind === 'photos' ? 'photos' : 'video',
      video_url: media!.kind === 'video' ? media!.url : null,
      photo_urls: media!.kind === 'photos' ? media!.urls : null,
      is_free_trial: freeTrial,
    }
    if (!freeTrial) {
      payload.price_30 = p30n
      payload.price_60 = p60n
      payload.price_90 = p90n
    }

    // 3. Create listing
    const listingRes = await fetch('/api/ambassador/model/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!listingRes.ok) {
      showToast({ emoji: '📡', message: 'Couldn’t reach server. Try again.' })
      throw new Error('listings POST failed')
    }
    const listingData = await listingRes.json() as { listing: { id: string; is_free_trial: boolean } }

    // 4. Redirect. Trial path lands on /listings with the ?new&type=trial
    // celebration flag. Paid path routes to the Send Payment Link page
    // (locked decision #5) — celebration for paid listings happens there,
    // not on the listings page, so no ?new flag for paid.
    if (listingData.listing.is_free_trial) {
      router.push(`/model/listings?new=${listingData.listing.id}&type=trial`)
    } else {
      router.push(`/model/listings/${listingData.listing.id}/send-link`)
    }
  }, [isValid, freeTrial, pricingValid, professionalId, instagram, name, city, country, avatarUrl, category, media, p30n, p60n, p90n, showToast, router, isEdit, listing])

  const onPriceInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/[^0-9]/g, '')
    setter(digitsOnly)
  }

  return (
    <div id={FOCUS_SCOPE_ID} style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative',
    }}>
      <style>{`
        #${FOCUS_SCOPE_ID} input[type="text"]:focus,
        #${FOCUS_SCOPE_ID} input[type="tel"]:focus,
        #${FOCUS_SCOPE_ID} input[type="email"]:focus {
          border-color: #e91e8c !important;
          transition: border-color 0.15s;
        }
        #${FOCUS_SCOPE_ID} .al-fw:focus-within {
          border-color: #e91e8c !important;
          transition: border-color 0.15s;
        }
        #${FOCUS_SCOPE_ID} input:disabled { color: #888; }
      `}</style>

      {/* Hidden file inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={onAvatarFilePicked}
        style={{ display: 'none' }}
      />
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={onMediaFilePicked}
        style={{ display: 'none' }}
      />

      {/* Header — back arrow. Edit-mode back mirrors the success
          redirect (/model/listings); add-mode back returns to the
          dashboard per the mockup add flow. */}
      <div style={{ padding: '36px 20px 0' }}>
        <BackArrow fallbackHref={isEdit ? '/model/listings' : '/model'} />
      </div>

      {/* Hero */}
      <div style={{ padding: '8px 22px 22px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.2px', marginBottom: 6 }}>
          {isEdit ? 'Edit listing' : 'Add listing'}
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>
          {isEdit ? 'Update the details — photo, category, pricing' : 'Professional you want to display on your page'}
        </div>
      </div>

      <div style={{ padding: '0 20px 24px' }}>

        {/* ================== PROFESSIONAL ================== */}
        <div style={{ marginBottom: 22 }}>
          <div style={SECTION_LABEL}>Professional</div>

          <input
            type="text"
            placeholder="Salon, clinic or doctor name"
            value={name}
            onChange={(e) => setName(capFirst(e.target.value))}
            disabled={professionalLocked}
            style={{
              ...INPUT_BASE,
              marginBottom: 10,
              opacity: professionalLocked ? 0.6 : 1,
              cursor: professionalLocked ? 'not-allowed' : 'text',
            }}
          />

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            {/* Avatar tile — click opens picker. Shows image when uploaded. */}
            <div style={{ flexShrink: 0, position: 'relative' }}>
              <div
                onClick={openAvatarPicker}
                style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: '#1c1c1c',
                  border: avatarUrl
                    ? '2px solid transparent'
                    : '1.5px dashed #333',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', textAlign: 'center',
                  cursor: professionalLocked ? 'default' : 'pointer',
                  backgroundImage: avatarUrl
                    ? `linear-gradient(#000,#000), linear-gradient(45deg,#FEDA75 0%,#FA7E1E 25%,#D62976 50%,#962FBF 100%)`
                    : undefined,
                  backgroundOrigin: avatarUrl ? 'border-box' : undefined,
                  backgroundClip: avatarUrl ? 'padding-box, border-box' : undefined,
                  padding: avatarUrl ? 2 : 0,
                }}
              >
                {uploadingAvatar ? (
                  <div style={{ fontSize: 9, color: '#888' }}>…</div>
                ) : avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
                  />
                ) : (
                  <div style={{ fontSize: 8, color: '#666', lineHeight: 1.2, fontWeight: 500 }}>
                    Profile<br />Image
                  </div>
                )}
              </div>
              {/* Remove button — only when avatar present and not locked */}
              {avatarUrl && !professionalLocked && !uploadingAvatar && (
                <div
                  onClick={(e) => { e.stopPropagation(); removeAvatar() }}
                  style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#000', border: '1.5px solid #262626',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
              )}
              {!avatarUrl && !uploadingAvatar && (
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#1c1c1c', border: '2px solid #1c1c1c',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0z" fill="#e91e8c" />
                    <path d="M12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z" fill="#e91e8c" />
                    <circle cx="18.406" cy="5.594" r="1.44" fill="#e91e8c" />
                  </svg>
                </div>
              )}
            </div>

            {/* Category dropdown */}
            <div ref={catRef} style={{ flex: 1, position: 'relative' }}>
              <div
                onClick={() => setCategoryOpen((o) => !o)}
                style={{
                  background: '#1c1c1c',
                  border: '1.5px solid #262626',
                  borderRadius: 12,
                  padding: '14px 16px',
                  fontSize: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: category
                    ? (category.type === 'custom' && !customCategoryText ? '#e91e8c' : '#fff')
                    : '#666',
                }}
              >
                <span>
                  {category
                    ? (category.type === 'id'
                        ? category.label
                        : (customCategoryText || 'Customize'))
                    : 'Category'}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {categoryOpen && (
                <div style={{
                  position: 'absolute',
                  top: 52, left: 0, right: 0,
                  background: '#1c1c1c',
                  border: '1.5px solid #333',
                  borderRadius: 12,
                  zIndex: 10,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}>
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => selectCategory(c)}
                      style={{ padding: '12px 16px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #262626' }}
                    >
                      {c.label}
                    </div>
                  ))}
                  <div
                    onClick={selectCustom}
                    style={{ padding: '12px 16px', fontSize: 13, cursor: 'pointer', color: '#e91e8c', borderTop: '1px solid #333' }}
                  >
                    Customize
                  </div>
                </div>
              )}
            </div>
          </div>

          {avatarError && (
            <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 10, paddingLeft: 4 }}>
              {avatarError}
            </div>
          )}

          {showCustomInput && (
            <div style={{ marginBottom: 10 }}>
              <div className="al-fw" style={{
                background: '#1c1c1c', border: '1.5px solid #262626', borderRadius: 12,
                display: 'flex', alignItems: 'center', transition: 'border-color 0.15s',
              }}>
                <input
                  type="text"
                  placeholder="Type your category and press Enter"
                  value={customCategoryText}
                  onChange={(e) => onCustomCategoryChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() } }}
                  style={{
                    flex: 1, minWidth: 0,
                    background: 'transparent', border: 'none', outline: 'none',
                    padding: '14px 16px', fontSize: 14, color: '#fff', fontFamily: 'inherit',
                  }}
                />
                {customCategoryText.trim().length >= 2 && (
                  <span style={{ paddingRight: 14, flexShrink: 0, display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(capFirst(e.target.value))}
              disabled={professionalLocked}
              style={{
                ...INPUT_BASE, flex: 1, minWidth: 0,
                opacity: professionalLocked ? 0.6 : 1,
                cursor: professionalLocked ? 'not-allowed' : 'text',
              }}
            />
            <input
              type="text"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(capFirst(e.target.value))}
              disabled={professionalLocked}
              style={{
                ...INPUT_BASE, flex: 1, minWidth: 0,
                opacity: professionalLocked ? 0.6 : 1,
                cursor: professionalLocked ? 'not-allowed' : 'text',
              }}
            />
          </div>

          <div className="al-fw" style={{
            background: '#1c1c1c', border: '1.5px solid #262626', borderRadius: 12,
            padding: '0 16px', fontSize: 14, display: 'flex', alignItems: 'center',
            gap: 10, height: 48, transition: 'border-color 0.15s',
            opacity: isEdit ? 0.6 : 1,
            cursor: isEdit ? 'not-allowed' : 'text',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0z" fill="#e91e8c" />
              <path d="M12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z" fill="#e91e8c" />
              <circle cx="18.406" cy="5.594" r="1.44" fill="#e91e8c" />
            </svg>
            <input
              type="text"
              placeholder="Professional's username"
              value={instagram}
              onChange={(e) => onInstagramChange(e.target.value)}
              onBlur={onInstagramBlur}
              disabled={isEdit}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 14, color: '#fff', fontFamily: 'inherit', padding: 0,
                cursor: isEdit ? 'not-allowed' : 'text',
              }}
            />
            {dedupInFlight && (
              <span style={{ fontSize: 11, color: '#666', flexShrink: 0 }}>…</span>
            )}
          </div>
        </div>

        {/* ================== MEDIA ================== */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...SECTION_LABEL, marginBottom: 0 }}>Media</div>
            {media?.kind === 'photos' && (
              <div style={{ fontSize: 11, color: '#666' }}>{media.urls.length}/3 images</div>
            )}
          </div>

          {!media && !uploadingMedia && (
            <div
              onClick={openMediaPicker}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: '#1c1c1c', border: '1.5px dashed #333', borderRadius: 12, padding: 24,
                cursor: 'pointer',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <div style={{ fontSize: 11, color: '#666' }}>Upload 1 video OR up to 3 photos</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Vertical works best</div>
            </div>
          )}

          {uploadingMedia && !media && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#1c1c1c', border: '1.5px dashed #333', borderRadius: 12, padding: 24,
              fontSize: 11, color: '#888',
            }}>
              Uploading…
            </div>
          )}

          {media?.kind === 'video' && (
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#1c1c1c', border: '1.5px solid #262626' }}>
              <video
                src={media.previewUrl}
                controls
                style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
              />
              <div
                onClick={removeMediaVideo}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 26, height: 26, background: 'rgba(0,0,0,0.7)', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            </div>
          )}

          {media?.kind === 'photos' && (
            <div style={{ display: 'flex', gap: 8 }}>
              {media.urls.map((url, i) => (
                <div key={i} style={{ flex: 1, aspectRatio: '9/16', position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#1c1c1c', border: '1.5px solid #262626' }}>
                  { /* eslint-disable-next-line @next/next/no-img-element */ }
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div
                    onClick={() => removeMediaPhoto(i)}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 22, height: 22, background: 'rgba(0,0,0,0.75)', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                </div>
              ))}
              {media.urls.length < 3 && Array.from({ length: 3 - media.urls.length }).map((_, j) => (
                <div
                  key={`empty-${j}`}
                  onClick={openMediaPicker}
                  style={{
                    flex: 1, aspectRatio: '9/16', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: '#1c1c1c', border: '1.5px dashed #333', borderRadius: 12, cursor: 'pointer',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
              ))}
            </div>
          )}

          {mediaError && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 8, paddingLeft: 4 }}>
              {mediaError}
            </div>
          )}
        </div>

        {/* ================== PRICING ================== */}
        {/* inert when freeTrial=true — section collapses via maxHeight/opacity
            but the inputs stayed tabbable without it (see Slice 3C Phase 2
            review, Flag 2). */}
        <div inert={freeTrial} style={{
          marginBottom: freeTrial ? 0 : 22,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease, opacity 0.25s ease, margin-bottom 0.3s ease',
          maxHeight: freeTrial ? 0 : 500,
          opacity: freeTrial ? 0 : 1,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...SECTION_LABEL, marginBottom: 0 }}>Pricing</div>
            <div style={{ fontSize: 11, color: '#666' }}>{currency.toUpperCase()} ({symbol})</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <PriceBox
              days={30} value={p30} onInput={onPriceInput(setP30)}
              onFocus={() => setTouched30(false)} onBlur={() => setTouched30(true)}
              perDay={perDay30} symbol={symbol} bad={box30Bad}
            />
            <PriceBox
              days={60} value={p60} onInput={onPriceInput(setP60)}
              onFocus={() => setTouched60(false)} onBlur={() => setTouched60(true)}
              perDay={perDay60} symbol={symbol} bad={box60Bad} offPct={off60}
            />
            <PriceBox
              days={90} value={p90} onInput={onPriceInput(setP90)}
              onFocus={() => setTouched90(false)} onBlur={() => setTouched90(true)}
              perDay={perDay90} symbol={symbol} bad={box90Bad} offPct={off90}
            />
          </div>

          {pricingError && (
            <div style={{ fontSize: 11, color: '#e91e8c', marginTop: 12, textAlign: 'center' }}>
              {pricingError}
            </div>
          )}
        </div>

        {/* ================== FREE TRIAL ================== */}
        <div style={{
          background: '#1c1c1c', border: `1.5px solid ${freeTrial ? '#e91e8c' : '#262626'}`,
          borderRadius: 12, padding: '14px 16px', marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          transition: 'border-color 0.25s',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Free 30-day trial</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>Listing goes live immediately</div>
          </div>
          <div
            onClick={isEdit ? undefined : () => setFreeTrial((v) => !v)}
            style={{
              width: 44, height: 24, background: freeTrial ? '#e91e8c' : '#262626',
              borderRadius: 12, position: 'relative',
              cursor: isEdit ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s', flexShrink: 0,
              opacity: isEdit ? 0.6 : 1,
            }}
          >
            <div style={{
              width: 20, height: 20, background: '#fff', borderRadius: '50%',
              position: 'absolute', top: 2, left: freeTrial ? 22 : 2,
              transition: 'left 0.2s',
            }} />
          </div>
        </div>

        {/* ================== CREATE LISTING ================== */}
        <AmbSubmitButton
          verb="save"
          variant="solid"
          idleLabel={submitIdleLabel}
          disabled={!isValid}
          onSubmit={handleSubmit}
        />
      </div>

      {/* Cropper mounts — portaled internally */}
      {avatarCropperFile && (
        <ImageCropper
          sourceFile={avatarCropperFile}
          mode="avatar"
          onCropComplete={onAvatarCropComplete}
          onCancel={onAvatarCropCancel}
        />
      )}
      {mediaCropperFile && (
        <ImageCropper
          sourceFile={mediaCropperFile}
          mode="listing"
          onCropComplete={onMediaCropComplete}
          onCancel={onMediaCropCancel}
        />
      )}

      {/* Toast — canonical amb-toast-in/out animation (Slice 3A retrofit pattern) */}
      {toast && (
        <div
          key={toastKey}
          style={{
            position: 'fixed',
            top: 50, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(28,28,28,0.95)', border: '1px solid #333',
            color: '#fff', fontSize: 12, padding: '10px 18px', borderRadius: 24,
            zIndex: 150, whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 8,
            pointerEvents: 'none',
            animation:
              'amb-toast-in 1200ms cubic-bezier(.2,.7,.2,1) forwards, ' +
              'amb-toast-out 1200ms cubic-bezier(.5,.2,.8,.1) 4000ms forwards',
          }}
        >
          {toast.emoji && <span style={{ fontSize: 14, lineHeight: 1 }}>{toast.emoji}</span>}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}

