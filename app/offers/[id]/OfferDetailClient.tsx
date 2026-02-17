'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { DirhamSymbol } from '@/components/DirhamSymbol'
import {
  getOfferById,
  getOfferImageUrl,
  getBusinessLogoUrl,
  getDaysUntilExpiry,
  getInstagramUrl,
  getQuantityRemaining,
  type PublicOffer,
} from '@/lib/data/offers'

export default function OfferDetailClient() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [offer, setOffer] = useState<PublicOffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    loadOffer()
    checkAuth()
  }, [id])

  const loadOffer = async () => {
    setLoading(true)
    const { data, error: err } = await getOfferById(id)
    if (err || !data) {
      setError('Offer not found or no longer available.')
    } else {
      setOffer(data as unknown as PublicOffer)
    }
    setLoading(false)
  }

  const checkAuth = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setIsLoggedIn(true)
    }
  }

  const handleBuyNow = () => {
    if (!isLoggedIn) {
      router.push(`/auth?redirectTo=/offers/${id}&role=Buyer`)
      return
    }

    router.push(`/offers/${id}/checkout`)
  }

  if (loading) {
    return (
      <div className="offers-empty">
        <div className="offers-spinner" />
        <p className="text-sm text-white/40 mt-4">Loading offer...</p>
      </div>
    )
  }

  if (error || !offer) {
    return (
      <div className="offers-empty">
        <div className="mb-4">
          <svg className="w-12 h-12 mx-auto opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <p className="text-lg font-medium text-white/50 mb-1">{error || 'Offer not found'}</p>
        <Link href="/offers" className="text-sm text-purple-400 hover:text-purple-300 mt-3 inline-block">
          ← Back
        </Link>
      </div>
    )
  }

  const imageUrl = getOfferImageUrl(offer.image_url)
  const logoUrl = getBusinessLogoUrl(offer.business_photo_url)
  const instagramUrl = getInstagramUrl(offer.instagram_handle)
  const daysLeft = getDaysUntilExpiry(offer.expires_at)
  const remaining = getQuantityRemaining(offer)
  const hasDiscount = offer.original_price && offer.original_price > offer.price

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Back link + days left */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/offers" className="text-sm text-white/40 hover:text-white/60 no-underline">
          ← Back
        </Link>
        <span className="text-sm text-white/40 pr-2">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
      </div>

      {/* Offer Image */}
      <div className="relative rounded-xl overflow-hidden bg-white/5 mb-5 aspect-square">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={offer.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center">
            <svg className="w-16 h-16 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Salon Info */}
      <div className="flex items-center gap-3 mb-5">
        {instagramUrl ? (
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
            <div className="instagram-avatar-sm">
              {logoUrl ? (
                <img src={logoUrl} alt="" />
              ) : (
                <div className="avatar-fallback">
                  <span>{offer.business_name?.charAt(0)}</span>
                </div>
              )}
            </div>
          </a>
        ) : (
          <div className="instagram-avatar-sm">
            {logoUrl ? (
              <img src={logoUrl} alt="" />
            ) : (
              <div className="avatar-fallback">
                <span>{offer.business_name?.charAt(0)}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-white truncate">{offer.business_name}</p>
          </div>
          <div className="flex items-center justify-between text-sm text-white/50">
            <div className="flex items-center gap-3">
              {offer.city && <span>{offer.city}</span>}
              {offer.google_rating != null && (
                <span className="inline-flex items-center gap-0.5">
                  <svg className="w-3.5 h-3.5 shrink-0 fill-yellow-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  {offer.google_rating.toFixed(1)}
                  {offer.google_reviews_count != null && ` (${offer.google_reviews_count})`}
                </span>
              )}
            </div>
          </div>
        </div>
        {offer.whatsapp_number && (
          <a
            href={`https://wa.me/${offer.whatsapp_number.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="offers-whatsapp-btn"
            title="Chat on WhatsApp"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214l-.252-.156-2.786.828.828-2.786-.156-.252A8 8 0 1112 20z" />
            </svg>
            <span>Chat Now</span>
          </a>
        )}
      </div>

      {/* Title */}
      <h1 className="text-xl font-bold text-white mt-3 mb-0">{offer.title}</h1>

      {/* Description */}
      {offer.description && (
        <p className="text-[13px] text-white/50 leading-relaxed mb-5 whitespace-pre-line">
          {offer.description}
        </p>
      )}

      {/* Price */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <span className="offers-price text-[34px]">
            <DirhamSymbol size={18} /> {offer.price}
          </span>
          {hasDiscount && (
            <span className="offers-price-original text-[26px]">
              {offer.original_price}
            </span>
          )}
        </div>
        {/* Right: offers left + share */}
        <div className="flex flex-col items-end gap-0">
          <span className="text-sm text-white/40 pr-2">{remaining} offers left</span>
          <button
            onClick={() => {
              const text = window.location.href;
              window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
            }}
            className="flex items-center px-2 py-1 rounded-full text-[10px] font-medium bg-[#25d366]/15 text-[#25d366] hover:bg-[#25d366]/25 transition-colors"
          >
            Share with Bestie
          </button>
        </div>
      </div>

      {/* Buy / View Only */}
      <button
        onClick={handleBuyNow}
        className="offers-buy-btn w-full"
      >
        Buy Now
      </button>

      {/* Error display */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center">
          {error}
        </div>
      )}
    </div>
  )
}
