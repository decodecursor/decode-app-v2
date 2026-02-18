'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getUserWithProxy } from '@/utils/auth-helper'
import { createClient } from '@/utils/supabase/client'
import { DirhamSymbol } from '@/components/DirhamSymbol'

interface SessionData {
  status: string
  offer_title: string
  business_name: string
  amount_paid: number
  currency: string
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/30" />
      </div>
    }>
      <PurchaseSuccessContent />
    </Suspense>
  )
}

function PurchaseSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const paymentIntentParam = searchParams.get('payment_intent')
  const offerIdParam = searchParams.get('offer_id')

  const [loading, setLoading] = useState(true)
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { user } = await getUserWithProxy()
      if (!user) {
        router.replace('/auth?redirectTo=/offers&role=Buyer')
        return
      }

      // Embedded checkout flow: payment_intent + offer_id params
      if (paymentIntentParam && offerIdParam) {
        try {
          const supabase = createClient()
          const { data: offer } = await supabase
            .from('beauty_offers')
            .select('title, price, beauty_businesses!inner(business_name)')
            .eq('id', offerIdParam)
            .single()

          if (offer) {
            const business = (offer as any).beauty_businesses
            setSessionData({
              status: 'paid',
              offer_title: offer.title,
              business_name: business?.business_name || '',
              amount_paid: offer.price,
              currency: 'AED',
            })
          } else {
            setError('Could not load purchase details')
          }
        } catch {
          setError('Something went wrong')
        }
        setLoading(false)
        return
      }

      // Legacy flow: session_id param
      if (!sessionId) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/offers/checkout?session_id=${sessionId}`)
        if (res.ok) {
          const data = await res.json()
          setSessionData(data)
        } else {
          setError('Could not load purchase details')
        }
      } catch {
        setError('Something went wrong')
      }

      setLoading(false)
    }
    init()
  }, [router, sessionId, paymentIntentParam, offerIdParam])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/30" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Purchase Confirmed!</h1>

        {sessionData ? (
          <div className="mt-4 space-y-3">
            <p className="text-white/80 font-medium">{sessionData.offer_title}</p>
            <p className="text-white/50 text-sm">{sessionData.business_name}</p>
            <p className="text-white font-medium"><DirhamSymbol size={12} /> {sessionData.amount_paid}</p>
          </div>
        ) : error ? (
          <p className="text-white/40 text-sm">{error}</p>
        ) : (
          <p className="text-white/40 text-sm">Your deal details will appear here.</p>
        )}
      </div>

      <Link
        href="/offers/my-offers"
        className="inline-block mt-6 px-6 py-3 rounded-xl text-white font-medium text-sm no-underline transition-colors"
        style={{ backgroundColor: '#E1306C' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#c9245e')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#E1306C')}
      >
        View in My Offers
      </Link>
    </div>
  )
}
