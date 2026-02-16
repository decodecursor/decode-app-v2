'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import { createClient } from '@/utils/supabase/client'

interface PurchaseDetail {
  id: string
  status: string
  amount_paid: number
  created_at: string
  refund_requested_at: string | null
  redeemed_at: string | null
  qr_code_secret: string
  beauty_offers: {
    title: string
    price: number
  }
  beauty_businesses: {
    business_name: string
  }
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Available',
}

export default function DealDetailPage() {
  const router = useRouter()
  const params = useParams()
  const purchaseId = params.purchaseId as string

  const [loading, setLoading] = useState(true)
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null)
  const [buyerName, setBuyerName] = useState<string>('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [refundRequested, setRefundRequested] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace(`/auth?redirectTo=/offers/my-offers/${purchaseId}&role=Buyer`)
        return
      }

      // Fetch buyer name
      const { data: profile } = await supabase
        .from('users')
        .select('user_name')
        .eq('id', user.id)
        .single()
      setBuyerName(profile?.user_name || user.email?.split('@')[0] || 'Customer')

      const { data, error: fetchError } = await supabase
        .from('beauty_purchases')
        .select('id, status, amount_paid, created_at, refund_requested_at, redeemed_at, qr_code_secret, beauty_offers!inner(title, price), beauty_businesses!inner(business_name)')
        .eq('id', purchaseId)
        .eq('buyer_id', user.id)
        .single()

      if (fetchError || !data) {
        setError('Purchase not found')
      } else {
        const p = data as unknown as PurchaseDetail
        setPurchase(p)
        setRefundRequested(!!data.refund_requested_at)

        // Generate QR code if active
        if (p.status === 'active' && p.qr_code_secret) {
          const siteUrl = window.location.origin
          const redeemUrl = `${siteUrl}/offers/redeem/${p.qr_code_secret}`
          const url = await QRCode.toDataURL(redeemUrl, {
            width: 280,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
          })
          setQrDataUrl(url)
        }
      }

      setLoading(false)
    }
    load()
  }, [router, purchaseId])

  const handleRefund = async () => {
    setRequesting(true)
    setError(null)

    try {
      const res = await fetch('/api/offers/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId }),
      })

      if (res.ok) {
        setRefundRequested(true)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to request refund')
      }
    } catch {
      setError('Something went wrong')
    }

    setRequesting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="offers-spinner" />
      </div>
    )
  }

  if (error && !purchase) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="offers-empty">
          <p className="text-lg font-medium text-white/50 mb-1">{error}</p>
          <Link href="/offers/my-offers" className="text-sm text-purple-400 hover:text-purple-300 mt-3 inline-block">
            ← Back
          </Link>
        </div>
      </div>
    )
  }

  if (!purchase) return null

  const offer = purchase.beauty_offers
  const business = purchase.beauty_businesses
  const purchaseDate = new Date(purchase.created_at)
  const daysSince = (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
  const canRefund = purchase.status === 'active' && daysSince <= 3 && !refundRequested

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/offers/my-offers" className="text-sm text-white/40 hover:text-white/60 mb-4 inline-block no-underline">
        ← Back
      </Link>

      <div className="bg-white/5 rounded-xl px-6 py-4 mb-6">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h1 className="text-xl font-bold text-white">{offer.title}</h1>
          <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
            purchase.status === 'active' ? 'bg-green-500/10 text-green-400' :
            purchase.status === 'redeemed' ? 'bg-blue-500/10 text-blue-400' :
            purchase.status === 'refunded' ? 'bg-orange-500/10 text-orange-400' :
            'bg-white/5 text-white/40'
          }`}>
            {STATUS_LABELS[purchase.status] || purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
          </span>
        </div>
        <p className="text-sm text-white/50">{business.business_name}</p>
      </div>

      {/* QR Voucher */}
      <div className="mt-6 bg-white/5 rounded-xl p-6 text-center">
        {purchase.status === 'active' && qrDataUrl ? (
          <>
            <p className="text-xs text-white/40 mb-3">Show this QR code at the salon to redeem</p>
            <img src={qrDataUrl} alt="QR Code" className="mx-auto rounded-lg" width={280} height={280} />
            <p className="text-xs text-white/40 mt-3">{purchase.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-xl font-bold text-white mt-1">{buyerName}</p>
          </>
        ) : purchase.status === 'redeemed' ? (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-base font-semibold text-blue-400 mb-1">Redeemed</p>
            {purchase.redeemed_at && (
              <p className="text-xs text-white/30">
                {new Date(purchase.redeemed_at).toLocaleString('en-AE', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-white/30">
            {purchase.status === 'refunded' ? 'This deal has been refunded.' : 'Voucher not available.'}
          </p>
        )}
      </div>

      {/* Refund section */}
      {purchase.status === 'active' && (daysSince <= 3 || refundRequested) && (
        <div className="mt-6 bg-white/5 rounded-xl p-6">
          {refundRequested ? (
            <div>
              <p className="text-sm text-orange-400 font-medium mb-1">Refund Requested</p>
              <p className="text-xs text-white/40">Your refund request is being reviewed. We'll update you within 1–2 business days.</p>
            </div>
          ) : canRefund ? (
            <div>
              <button
                onClick={handleRefund}
                disabled={requesting}
                className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {requesting ? 'Requesting...' : 'Request Refund'}
              </button>
              <p className="text-[11px] sm:text-xs text-white/30 text-center mt-2">
                Refunds are reviewed manually within 1–2 business days
              </p>
            </div>
          ) : daysSince > 3 ? (
            <p className="text-xs text-white/30 text-center">
              Refund window has expired (3 days from purchase)
            </p>
          ) : null}

          {error && (
            <p className="text-xs text-red-400 text-center mt-2">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
