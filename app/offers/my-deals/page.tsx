'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
        router.replace('/auth?redirectTo=/offers/my-deals&role=Buyer')
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/30" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-6">My Deals</h1>

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
            const date = new Date(p.created_at).toLocaleDateString('en-AE', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })

            return (
              <Link
                key={p.id}
                href={`/offers/my-deals/${p.id}`}
                className="block bg-white/5 rounded-xl p-4 hover:bg-white/[0.07] transition-colors no-underline"
              >
                <div className="flex gap-4">
                  {imgUrl && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                      <Image
                        src={imgUrl}
                        alt={offer.title}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{offer.title}</h3>
                    <p className="text-xs text-white/40 mt-0.5">{business.business_name}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-white/70">
                        <DirhamSymbol size={11} /> {p.amount_paid}
                      </span>
                      <span className="text-xs text-white/30">{date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status] || STATUS_STYLES.expired}`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center text-white/20">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
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
