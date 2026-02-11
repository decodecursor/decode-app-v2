'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { USER_ROLES } from '@/types/user'

interface BusinessData {
  id: string
  business_name: string
  instagram_handle: string
  city: string
  business_photo_url: string | null
  google_rating: number | null
  google_reviews_count: number | null
  whatsapp_number: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [business, setBusiness] = useState<BusinessData | null>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('error')

  // Form state — business setup (only shown if no business exists)
  const [businessName, setBusinessName] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')
  const [city, setCity] = useState('')

  // Form state — settings (shown when business exists)
  const [googleRating, setGoogleRating] = useState('')
  const [googleReviewsCount, setGoogleReviewsCount] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')

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

      setUserId(user.id)

      const { data: biz } = await supabase
        .from('beauty_businesses')
        .select('*')
        .eq('creator_id', user.id)
        .single()

      if (biz) {
        setBusiness(biz)
        setGoogleRating(biz.google_rating?.toString() || '')
        setGoogleReviewsCount(biz.google_reviews_count?.toString() || '')
        setWhatsappNumber(biz.whatsapp_number || '')
      }

      setLoading(false)
    }
    init()
  }, [router, supabase])

  // Auto-hide messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    setSaving(true)
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('beauty_businesses')
        .insert({
          creator_id: userId,
          business_name: businessName.trim(),
          instagram_handle: instagramHandle.trim(),
          city: city.trim(),
        })
        .select()
        .single()

      if (error) throw error

      setBusiness(data)
      setMessage('Business profile created')
      setMessageType('success')
    } catch (err: any) {
      console.error('Create business error:', err)
      setMessage(err.message || 'Failed to create business profile')
      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!business) return

    const ratingNum = googleRating ? parseFloat(googleRating) : null
    if (ratingNum !== null && (ratingNum < 1 || ratingNum > 5)) {
      setMessage('Rating must be between 1.0 and 5.0')
      setMessageType('error')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const { error } = await supabase
        .from('beauty_businesses')
        .update({
          google_rating: ratingNum,
          google_reviews_count: googleReviewsCount ? parseInt(googleReviewsCount) : null,
          whatsapp_number: whatsappNumber.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', business.id)

      if (error) throw error

      setMessage('Settings saved')
      setMessageType('success')
    } catch (err: any) {
      console.error('Save settings error:', err)
      setMessage(err.message || 'Failed to save settings')
      setMessageType('error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    )
  }

  return (
    <div className="cosmic-bg min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white text-sm mb-1 block"
          >
            &larr; Dashboard
          </button>
          <h1 className="text-xl font-semibold text-white">Business Settings</h1>
        </div>

        {!business ? (
          /* Business Setup Form */
          <form onSubmit={handleCreateBusiness} className="space-y-5">
            <p className="text-gray-400 text-sm mb-4">
              Set up your business profile to start creating offers.
            </p>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Business Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Glow Beauty Salon"
                className="cosmic-input"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Instagram Handle</label>
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="@glowbeauty"
                className="cosmic-input"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Dubai"
                className="cosmic-input"
                required
              />
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm text-center ${
                messageType === 'success'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !businessName.trim() || !instagramHandle.trim() || !city.trim()}
              className="cosmic-button-primary w-full py-3"
            >
              {saving ? 'Creating...' : 'Create Business Profile'}
            </button>
          </form>
        ) : (
          /* Settings Form */
          <form onSubmit={handleSaveSettings} className="space-y-5">
            {/* Business Info (read-only) */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-2">
              <p className="text-white font-medium">{business.business_name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{business.instagram_handle} &middot; {business.city}</p>
            </div>

            <hr className="border-white/10" />

            {/* Google Reviews */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">Google Reviews</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rating (1.0 - 5.0)</label>
                  <input
                    type="number"
                    value={googleRating}
                    onChange={(e) => setGoogleRating(e.target.value)}
                    placeholder="4.5"
                    className="cosmic-input"
                    min={1}
                    max={5}
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reviews Count</label>
                  <input
                    type="number"
                    value={googleReviewsCount}
                    onChange={(e) => setGoogleReviewsCount(e.target.value)}
                    placeholder="128"
                    className="cosmic-input"
                    min={0}
                  />
                </div>
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-3">WhatsApp Contact</h3>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+971501234567"
                className="cosmic-input"
              />
              <p className="text-xs text-gray-500 mt-1">Shown as &quot;Chat on WhatsApp&quot; on your offers</p>
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm text-center ${
                messageType === 'success'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="cosmic-button-primary w-full py-3"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
