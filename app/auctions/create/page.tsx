'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/providers/UserContext'
import { useRouter } from 'next/navigation'
import { USER_ROLES } from '@/types/user'
import { AUCTION_DURATIONS, type AuctionDuration } from '@/lib/models/Auction.model'

export default function CreateAuction() {
  const { user, profile, loading: contextLoading } = useUser()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    auction_start_price: '',
    duration: 60 as AuctionDuration
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [durationChanged, setDurationChanged] = useState(false)

  const router = useRouter()

  useEffect(() => {
    // Check auth and redirect if needed
    if (!contextLoading && !user) {
      router.push('/auth')
      return
    }

    // Check if user is a MODEL
    if (!contextLoading && profile) {
      if (profile.role !== USER_ROLES.MODEL) {
        router.push('/dashboard')
        return
      }
      setLoading(false)
    } else if (!contextLoading) {
      setLoading(false)
    }
  }, [contextLoading, user, profile, router])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    } else if (formData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters'
    }

    const startPrice = parseFloat(formData.auction_start_price.replace(/,/g, ''))
    if (!formData.auction_start_price || isNaN(startPrice) || startPrice <= 0) {
      newErrors.auction_start_price = 'Please enter a valid starting price'
    } else if (startPrice < 5) {
      newErrors.auction_start_price = 'Minimum starting price is AED 5'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAuctionPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target

    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '')

    // Handle decimal cases - allow only one decimal point
    const parts = numericValue.split('.')
    if (parts.length > 2) return // Don't update if multiple decimal points

    // Format integer part with commas
    if (parts[0]) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }

    const formattedValue = parts.join('.')
    setFormData({ ...formData, auction_start_price: formattedValue })

    // Clear errors when user starts typing
    if (errors.auction_start_price) {
      setErrors({ ...errors, auction_start_price: undefined })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validate()) return

    setCreating(true)

    try {
      const requestPayload = {
        title: formData.title.trim(),
        auction_start_price: parseFloat(formData.auction_start_price.replace(/,/g, '')),
        duration: formData.duration,
      }

      console.log('🚀 [CreateAuction] Sending request:', requestPayload)

      const response = await fetch('/api/auctions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })

      console.log('📥 [CreateAuction] Response status:', response.status, response.statusText)

      const data = await response.json()
      console.log('📋 [CreateAuction] Response data:', data)

      if (!response.ok) {
        console.error('❌ [CreateAuction] Request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          details: data.details,
          fullResponse: data
        })
        throw new Error(data.error || 'Failed to create auction')
      }

      // Success
      console.log('✅ [CreateAuction] Auction created successfully:', data.auction_id)
      router.replace(`/auctions/${data.auction_id}`)
    } catch (err) {
      console.error('💥 [CreateAuction] Exception caught:', err)
      setError(err instanceof Error ? err.message : 'Failed to create auction')
    } finally {
      setCreating(false)
    }
  }

  const handleCancel = () => {
    router.push('/dashboard')
  }

  // Show loading state while checking auth and fetching user data
  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen">
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-300">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // Check if all fields are filled (have purple borders)
  const allFieldsFilled = formData.title.trim() && formData.auction_start_price && durationChanged

  return (
    <div className="cosmic-bg min-h-screen">
      <div className="flex min-h-full items-center justify-center p-4 pt-14">
        <div className="w-full max-w-md transform overflow-hidden rounded-xl bg-gray-900 border border-gray-700 md:p-8 p-6 shadow-xl relative">
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute md:top-4 md:right-4 top-2 right-2 text-gray-400 hover:text-white transition-colors"
            disabled={creating}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center md:mb-8 mb-6">
            <div className="md:w-16 md:h-16 w-14 h-14 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="md:w-8 md:h-8 w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.5 3.5L21 7l-3.5 3.5L14 7l3.5-3.5zM3 17.25V21h3.75L15.81 11.94l-3.75-3.75L3 17.25zM5.92 19H5v-.92l7.06-7.06.92.92L5.92 19z"/>
                <path d="M2 22h20v2H2z"/>
              </svg>
            </div>
            <h2 className="md:text-2xl text-xl font-bold text-white mb-2">
              Create Beauty Auction
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                Auction Title
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value })
                  if (errors.title) setErrors({ ...errors, title: undefined })
                }}
                className={`w-full md:px-4 md:py-3 px-3 py-2 h-[42px] md:h-[50px] bg-gray-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none transition-colors ${
                  errors.title ? 'border-red-500' : formData.title.trim() ? 'border-purple-500' : 'border-gray-700 focus:border-purple-500'
                }`}
                placeholder="Russian Lips"
                disabled={creating}
              />
              {errors.title && <p className="mt-1 text-sm text-red-100">{errors.title}</p>}
            </div>

            {/* Starting Price */}
            <div>
              <label htmlFor="auction_start_price" className="block text-sm font-medium text-gray-300 mb-2">
                Starting Price
              </label>
              <div className="relative">
                <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400">AED</span>
                <input
                  type="text"
                  id="auction_start_price"
                  value={formData.auction_start_price}
                  onChange={handleAuctionPriceChange}
                  inputMode="numeric"
                  className={`w-full pl-14 md:pl-16 md:pr-4 pr-3 md:py-3 py-2 h-[42px] md:h-[50px] bg-gray-800 border rounded-lg text-white placeholder-gray-400 focus:outline-none transition-colors ${
                    errors.auction_start_price ? 'border-red-500' : formData.auction_start_price ? 'border-purple-500' : 'border-gray-700 focus:border-purple-500'
                  }`}
                  placeholder="800"
                  disabled={creating}
                />
              </div>
              {errors.auction_start_price && (
                <p className="mt-1 text-sm text-red-100">{errors.auction_start_price}</p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-300 mb-2">
                Auction Duration
              </label>
              <select
                id="duration"
                value={formData.duration}
                onChange={(e) => {
                  setFormData({ ...formData, duration: parseInt(e.target.value) as AuctionDuration })
                  setDurationChanged(true)
                }}
                className={`w-full md:px-4 md:py-3 px-3 py-2 h-[42px] md:h-[50px] bg-gray-800 border ${durationChanged ? 'border-purple-500' : 'border-gray-700'} rounded-lg text-white focus:border-purple-500 focus:outline-none transition-colors`}
                disabled={creating}
              >
                {AUCTION_DURATIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit Error */}
            {error && (
              <div className="p-4 bg-red-600/20 border border-red-500/30 rounded-lg text-red-100">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                disabled={creating}
                className="flex-1 cosmic-button-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className={`flex-1 ${allFieldsFilled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-black'} border border-purple-500 hover:border-purple-400 text-white font-medium md:py-3 md:px-4 py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {creating ? 'Creating...' : 'Create Auction'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
