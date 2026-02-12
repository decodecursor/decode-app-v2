'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DirhamSymbol } from '@/components/DirhamSymbol'
import {
  getPublicOffers,
  getOfferImageUrl,
  getBusinessLogoUrl,
  getDaysUntilExpiry,
  type PublicOffer,
} from '@/lib/data/offers'

const CATEGORIES = ['All', 'Aesthetics', 'Hair', 'Nails', 'Spa'] as const
const PAGE_SIZE = 20

export default function OffersPage() {
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [offers, setOffers] = useState<PublicOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const fetchOffers = useCallback(async (offset = 0, category = activeCategory) => {
    const isInitial = offset === 0
    if (isInitial) setLoading(true)
    else setLoadingMore(true)

    const { data, error } = await getPublicOffers(offset, PAGE_SIZE, category)

    if (!error && data) {
      const typed = data as unknown as PublicOffer[]
      if (isInitial) {
        setOffers(typed)
      } else {
        setOffers(prev => [...prev, ...typed])
      }
      setHasMore(typed.length === PAGE_SIZE)
    }

    if (isInitial) setLoading(false)
    else setLoadingMore(false)
  }, [activeCategory])

  useEffect(() => {
    fetchOffers(0, activeCategory)
  }, [activeCategory])

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category)
    setOffers([])
    setHasMore(true)
  }

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchOffers(offers.length)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Category Filter */}
      <div className="offers-category-scroll mb-6">
        <div className="flex gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryChange(category)}
              className={`offers-category-pill ${activeCategory === category ? 'active' : ''}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="offers-empty">
          <div className="offers-spinner" />
          <p className="text-sm text-white/40 mt-4">Loading offers...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && offers.length === 0 && (
        <div className="offers-empty">
          <div className="mb-4">
            <svg className="w-12 h-12 mx-auto opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-white/50 mb-1">No offers yet</p>
          <p className="text-sm text-white/30">
            Beauty deals will appear here when businesses publish them.
          </p>
        </div>
      )}

      {/* Feed Grid */}
      {!loading && offers.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="offers-load-more"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function OfferCard({ offer }: { offer: PublicOffer }) {
  const imageUrl = getOfferImageUrl(offer.image_url)
  const logoUrl = getBusinessLogoUrl(offer.business_photo_url)
  const daysLeft = getDaysUntilExpiry(offer.expires_at)
  const hasDiscount = offer.original_price && offer.original_price > offer.price

  return (
    <Link href={`/offers/${offer.id}`} className="offers-card block no-underline">
      {/* Image */}
      <div className="relative aspect-[4/3] bg-white/5">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={offer.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Salon info */}
        <div className="flex items-center gap-2 mb-[15px]">
          <div className="instagram-avatar-xs">
            {logoUrl ? (
              <img src={logoUrl} alt="" />
            ) : (
              <div className="avatar-fallback">
                <span className="text-white/40">{offer.business_name?.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/90 truncate">{offer.business_name}</p>
            {offer.google_rating != null && (
              <p className="text-xs text-white/40">
                <span className="text-[7px] leading-none inline-flex items-center align-middle">⭐</span> {offer.google_rating.toFixed(1)}
                {offer.google_reviews_count != null && (
                  <span> ({offer.google_reviews_count} reviews)</span>
                )}
              </p>
            )}
          </div>
          {/* Price */}
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto self-start mt-0.5">
            <span className="text-[18px] font-bold text-white">
              <DirhamSymbol size={13} /> {offer.price}
            </span>
            {hasDiscount && (
              <span className="text-[16px] text-white/30 offers-price-strikethrough">
                {offer.original_price}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-semibold text-white mb-0 line-clamp-1">
          {offer.title}
        </h3>

        {/* Description */}
        {offer.description && (
          <p className="text-xs text-white/40 line-clamp-2 mb-3">
            {offer.description}
          </p>
        )}

        {/* Buy button */}
        <button className="offers-buy-btn w-full">
          Buy Now
        </button>
      </div>
    </Link>
  )
}
