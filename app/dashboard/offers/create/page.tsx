'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { USER_ROLES } from '@/types/user'

const CATEGORIES = ['aesthetics', 'hair', 'nails', 'spa'] as const
const DURATIONS = [
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
] as const

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

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [duration, setDuration] = useState<number>(7)

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

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setMessage('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessId) return

    const priceNum = parseFloat(price)
    const quantityNum = parseInt(quantity)
    const originalPriceNum = originalPrice ? parseFloat(originalPrice) : null

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
        const ext = imageFile.name.split('.').pop()
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
            className="text-gray-400 hover:text-white text-sm"
          >
            &larr; Back
          </button>
          <h1 className="text-xl font-semibold text-white">Create Offer</h1>
          <div className="w-12" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="e.g. Full Body Wax Special"
              className="cosmic-input"
              required
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">{title.length}/100</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="What's included in this offer?"
              className="cosmic-input"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">{description.length}/500</p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="cosmic-input"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Price row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Price (AED)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="99"
                className="cosmic-input"
                required
                min={5}
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Original Price</label>
              <input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="199 (optional)"
                className="cosmic-input"
                min={0}
                step="0.01"
              />
            </div>
          </div>

          {/* Quantity + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="cosmic-input"
                required
                min={1}
                max={999}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="cosmic-input"
              >
                {DURATIONS.map((d) => (
                  <option key={d.days} value={d.days}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Image</label>
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
                  className="w-full h-48 object-cover rounded-lg border border-white/10"
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
                className="w-full h-32 border border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-purple-500/40 hover:text-gray-400 transition-colors"
              >
                <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs">Upload image (max 5MB)</span>
              </button>
            )}
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
            disabled={submitting || !title.trim() || !price || !quantity}
            className="cosmic-button-primary w-full py-3"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Creating...
              </span>
            ) : (
              'Create Offer'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
