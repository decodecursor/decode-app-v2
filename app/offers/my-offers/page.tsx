'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { getUserWithProxy } from '@/utils/auth-helper'
import { createClient } from '@/utils/supabase/client'
import { getOfferImageUrl } from '@/lib/data/offers'
import { DirhamSymbol } from '@/components/DirhamSymbol'

interface Purchase {
  id: string
  status: string
  amount_paid: number
  created_at: string
  beauty_offers: {
    title: string
    price: number
    image_url: string | null
  }
  beauty_businesses: {
    business_name: string
  }
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Available',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  redeemed: 'bg-blue-500/10 text-blue-400',
  refunded: 'bg-orange-500/10 text-orange-400',
  expired: 'bg-white/5 text-white/40',
}

export default function MyDealsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [purchases, setPurchases] = useState<Purchase[]>([])

  useEffect(() => {
    const load = async () => {
      const { user } = await getUserWithProxy()
      if (!user) {
        router.replace('/auth?redirectTo=/offers/my-offers&role=Buyer')
        return
      }

      const supabase = createClient()
      const { data } = await supabase
        .from('beauty_purchases')
        .select('id, status, amount_paid, created_at, beauty_offers!inner(title, price, image_url), beauty_businesses!inner(business_name)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })

      if (data) {
        setPurchases(data as unknown as Purchase[])
      }

      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="offers-empty">
        <div className="offers-spinner" />
        <p className="text-sm text-white/40 mt-4">Loading offers...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link href="/offers" className="text-sm text-white/40 hover:text-white/60 mb-4 inline-block no-underline">
        ← Back
      </Link>
      <h1 className="text-xl font-semibold mb-6">My Offers</h1>

      {purchases.length === 0 ? (
        <div className="offers-empty">
          <div className="mb-4">
            <svg className="w-12 h-12 mx-auto opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-white/50 mb-1">No deals yet</p>
          <p className="text-sm text-white/30">Your purchased beauty deals will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map((p) => {
            const offer = p.beauty_offers
            const business = p.beauty_businesses
            const imgUrl = getOfferImageUrl(offer.image_url)

            return (
              <Link
                key={p.id}
                href={`/offers/my-offers/${p.id}`}
                className="block bg-white/[0.07] rounded-xl p-4 hover:bg-white/[0.09] transition-colors no-underline"
              >
                <div className="flex gap-4">
                  {imgUrl && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                      <img
                        src={imgUrl}
                        alt={offer.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[15px] font-medium text-white truncate">{offer.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLES[p.status] || STATUS_STYLES.expired}`}>
                        {STATUS_LABELS[p.status] || p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-[13px] text-white/40 mt-[1px]">{business.business_name}</p>
                    <div className="flex items-center gap-3 mt-[1px]">
                      <span className="text-[15px] text-white/70 inline-flex items-center gap-1">
                        <DirhamSymbol size={12} /> {p.amount_paid}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
