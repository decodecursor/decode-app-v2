'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { USER_ROLES } from '@/types/user'
import OfferImageCropModal from '@/components/offers/OfferImageCropModal'

const CATEGORIES = ['aesthetics', 'hair', 'nails', 'spa', 'pilates'] as const
const DURATIONS = [
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
] as const

function formatWithCommas(value: string): string {
  const parts = value.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

function stripCommas(value: string): string {
  return value.replace(/,/g, '')
}

function generateOfferCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export default function CreateOfferPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLDivElement>(null)
  const durationRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showCropModal, setShowCropModal] = useState(false)
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [duration, setDuration] = useState<number>(7)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [durationOpen, setDurationOpen] = useState(false)
  const [attempted, setAttempted] = useState(false)

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false)
      }
      if (durationRef.current && !durationRef.current.contains(e.target as Node)) {
        setDurationOpen(false)
      }
    }
    if (categoryOpen || durationOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [categoryOpen, durationOpen])

  // Auth + business check
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== USER_ROLES.ADMIN && profile.role !== USER_ROLES.STAFF)) {
        router.push('/dashboard')
        return
      }

      // Get or prompt business
      const { data: business } = await supabase
        .from('beauty_businesses')
        .select('id')
        .eq('creator_id', user.id)
        .single()

      if (!business) {
        setMessage('You need to set up your business profile first. Go to Settings.')
        setLoading(false)
        return
      }

      setBusinessId(business.id)
      setLoading(false)
    }
    init()
  }, [router, supabase])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image must be under 5MB')
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Only JPEG, PNG, and WebP images are allowed')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setRawImageSrc(objectUrl)
    setShowCropModal(true)
    setMessage('')
  }

  const handleCropComplete = (blob: Blob) => {
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const croppedFile = new File([blob], `cropped.${ext}`, { type: blob.type })
    setImageFile(croppedFile)
    setImagePreview(URL.createObjectURL(blob))
    setShowCropModal(false)
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc)
    setRawImageSrc(null)
  }

  const errors = attempted ? {
    title: !title.trim(),
    description: !description.trim(),
    price: !price || parseFloat(stripCommas(price)) < 5,
    originalPrice: !originalPrice || (!!price && parseFloat(stripCommas(originalPrice)) <= parseFloat(stripCommas(price))),
    quantity: !quantity || parseInt(stripCommas(quantity)) < 1 || parseInt(stripCommas(quantity)) > 999,
    image: !imageFile,
  } : {} as Record<string, boolean>

  const hasErrors = Object.values(errors).some(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (!businessId) return

    const priceNum = parseFloat(stripCommas(price))
    const quantityNum = parseInt(stripCommas(quantity))
    const originalPriceNum = originalPrice ? parseFloat(stripCommas(originalPrice)) : null

    // Check validation
    const submitErrors = {
      title: !title.trim(),
      description: !description.trim(),
      price: !price || priceNum < 5,
      originalPrice: !originalPrice || (!!price && parseFloat(stripCommas(originalPrice)) <= priceNum),
      quantity: !quantity || quantityNum < 1 || quantityNum > 999,
      image: !imageFile,
    }
    if (Object.values(submitErrors).some(Boolean)) return

    if (priceNum < 5) { setMessage('Price must be at least 5 AED'); return }
    if (quantityNum < 1 || quantityNum > 999) { setMessage('Quantity must be 1-999'); return }
    if (originalPriceNum !== null && originalPriceNum <= priceNum) {
      setMessage('Original price must be higher than the offer price')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      let imageUrl: string | null = null

      // Upload image if provided
      if (imageFile) {
        const ext = imageFile.type === 'image/webp' ? 'webp' : 'jpg'
        const fileName = `${businessId}/${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('offer-images')
          .upload(fileName, imageFile, { contentType: imageFile.type })

        if (uploadError) throw new Error('Image upload failed: ' + uploadError.message)

        const { data: urlData } = supabase.storage
          .from('offer-images')
          .getPublicUrl(fileName)

        imageUrl = urlData.publicUrl
      }

      // Calculate expires_at
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + duration)

      const { data: { user } } = await supabase.auth.getUser()

      const { error: insertError } = await supabase
        .from('beauty_offers')
        .insert({
          business_id: businessId,
          created_by: user!.id,
          title: title.trim(),
          description: description.trim() || null,
          category,
          price: priceNum,
          original_price: originalPriceNum,
          quantity: quantityNum,
          image_url: imageUrl,
          offer_code: generateOfferCode(),
          expires_at: expiresAt.toISOString(),
        })

      if (insertError) throw insertError

      router.push('/dashboard/offers')
    } catch (err: any) {
      console.error('Create offer error:', err)
      setMessage(err.message || 'Failed to create offer')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="cosmic-bg cosmic-bg-dark min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    )
  }

  if (!businessId) {
    return (
      <div className="cosmic-bg cosmic-bg-dark min-h-screen flex items-center justify-center px-4">
        <div className="cosmic-card-profile text-center">
          <p className="text-white mb-4">{message || 'Business profile not found.'}</p>
          <button
            onClick={() => router.push('/dashboard/settings')}
            className="cosmic-button-primary"
          >
            Go to Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg cosmic-bg-dark min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/dashboard/offers')}
            className="text-gray-200 hover:text-white text-sm"
          >
            &larr; Back
          </button>
          <h1 className="text-xl font-semibold text-white">Create Offer</h1>
          <div className="w-12" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs text-gray-100 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="HydraFacial"
              className={`cosmic-input ${errors.title ? 'border-red-500/60' : ''}`}
              maxLength={100}
            />
            {errors.title && <p className="text-red-400 text-xs mt-1">Title is required</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-100 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Short offer description"
              className={`cosmic-input ${errors.description ? 'border-red-500/60' : ''}`}
              rows={2}
              maxLength={500}
            />
            {errors.description && <p className="text-red-400 text-xs mt-1">Description is required</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-gray-100 mb-1">Category</label>
            <div className="relative" ref={categoryRef}>
              <button
                type="button"
                onClick={() => { setCategoryOpen(!categoryOpen); setDurationOpen(false) }}
                className="cosmic-input w-full flex items-center justify-between text-left"
              >
                <span>{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                <svg
                  className={`w-4 h-4 text-white/40 transition-transform ${categoryOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {categoryOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-lg border border-white/10 bg-[#1a1a1a] shadow-xl overflow-hidden z-50">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setCategory(c); setCategoryOpen(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        category === c
                          ? 'text-white bg-white/10'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Price row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-100 mb-1">Offer Price</label>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, '')
                  setPrice(raw ? formatWithCommas(raw) : '')
                }}
                placeholder="99"
                className={`cosmic-input ${errors.price ? 'border-red-500/60' : ''}`}
              />
              {errors.price && <p className="text-red-400 text-xs mt-1">Min 5 AED</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-100 mb-1">Original Price</label>
              <input
                type="text"
                inputMode="decimal"
                value={originalPrice}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, '')
                  setOriginalPrice(raw ? formatWithCommas(raw) : '')
                }}
                placeholder="199"
                className={`cosmic-input ${errors.originalPrice ? 'border-red-500/60' : ''}`}
              />
              {errors.originalPrice && <p className="text-red-400 text-xs mt-1">Must be higher than offer price</p>}
            </div>
          </div>

          {/* Quantity + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-100 mb-1">Quantity</label>
              <input
                type="text"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '')
                  setQuantity(raw ? formatWithCommas(raw) : '')
                }}
                placeholder="10"
                className={`cosmic-input ${errors.quantity ? 'border-red-500/60' : ''}`}
              />
              {errors.quantity && <p className="text-red-400 text-xs mt-1">Required (1-999)</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-100 mb-1">Duration</label>
              <div className="relative" ref={durationRef}>
                <button
                  type="button"
                  onClick={() => { setDurationOpen(!durationOpen); setCategoryOpen(false) }}
                  className="cosmic-input w-full flex items-center justify-between text-left"
                >
                  <span>{DURATIONS.find((d) => d.days === duration)?.label}</span>
                  <svg
                    className={`w-4 h-4 text-white/40 transition-transform ${durationOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {durationOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 rounded-lg border border-white/10 bg-[#1a1a1a] shadow-xl overflow-hidden z-50">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.days}
                        type="button"
                        onClick={() => { setDuration(d.days); setDurationOpen(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          duration === d.days
                            ? 'text-white bg-white/10'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-xs text-gray-100 mb-1">Image</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full aspect-square object-cover rounded-lg border border-white/10"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null)
                    setImagePreview(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black/80"
                >
                  X
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full h-32 border border-dashed rounded-lg flex flex-col items-center justify-center text-gray-300 hover:border-purple-500/40 hover:text-gray-100 transition-colors ${errors.image ? 'border-red-500/60' : 'border-white/40'}`}
              >
                <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs">Upload image (1:1 ratio)</span>
              </button>
            )}
            {errors.image && <p className="text-red-400 text-xs mt-1">Image is required</p>}
          </div>

          {/* Message */}
          {message && (
            <div className="p-3 rounded-lg text-sm text-center bg-red-500/10 text-red-400 border border-red-500/20">
              {message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="offers-buy-btn w-full py-3"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Publishing...
              </span>
            ) : (
              'Publish Offer'
            )}
          </button>
        </form>

        {showCropModal && rawImageSrc && (
          <OfferImageCropModal
            imageSrc={rawImageSrc}
            onCropComplete={handleCropComplete}
            onCancel={() => {
              setShowCropModal(false)
              if (rawImageSrc) URL.revokeObjectURL(rawImageSrc)
              setRawImageSrc(null)
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />
        )}
      </div>
    </div>
  )
}
