'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface VoucherInfo {
  purchase_id: string
  status: string
  amount: number
  redeemed_at: string | null
  buyer_name: string
  offer_title: string
  offer_expires_at: string
  business_name: string
}

export default function RedeemPage() {
  const params = useParams()
  const secret = params.secret as string

  const [loading, setLoading] = useState(true)
  const [voucher, setVoucher] = useState<VoucherInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemed, setRedeemed] = useState(false)

  useEffect(() => {
    const lookup = async () => {
      try {
        const res = await fetch(`/api/offers/redeem?secret=${encodeURIComponent(secret)}`)
        if (res.ok) {
          const data: VoucherInfo = await res.json()
          setVoucher(data)
          if (data.status === 'redeemed') {
            setRedeemed(true)
          }
        } else {
          const data = await res.json()
          setError(data.error || 'Voucher not found')
        }
      } catch {
        setError('Something went wrong')
      }
      setLoading(false)
    }
    lookup()
  }, [secret])

  const handleRedeem = async () => {
    setRedeeming(true)
    setError(null)
    try {
      const res = await fetch('/api/offers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      })
      if (res.ok) {
        setRedeemed(true)
      } else {
        const data = await res.json()
        if (data.error === 'not_authenticated') {
          window.location.href = '/sign-in'
          return
        }
        if (data.error === 'wrong_salon') {
          setError(`This offer belongs to ${data.business_name}. Please ask the staff at that salon to redeem it.`)
        } else {
          setError(data.error || 'Failed to redeem')
        }
      }
    } catch {
      setError('Something went wrong')
    }
    setRedeeming(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/30" />
      </div>
    )
  }

  // Error / not found
  if (error && !voucher) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold mb-2">Cannot Redeem</h1>
        <p className="text-white/40 text-sm">{error}</p>
      </div>
    )
  }

  if (!voucher) return null

  // Already redeemed
  if (redeemed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-green-400 mb-2">Redeemed Successfully</h1>
        <p className="text-2xl font-bold text-white mb-1">{voucher.buyer_name}</p>
        <p className="text-white/50 text-sm">{voucher.offer_title}</p>
        <p className="text-white/30 text-xs mt-1">{voucher.business_name}</p>
      </div>
    )
  }

  // Expired check
  const isExpired = new Date(voucher.offer_expires_at) < new Date()
  if (isExpired) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold mb-2">Offer Expired</h1>
        <p className="text-white/40 text-sm">This voucher can no longer be redeemed.</p>
      </div>
    )
  }

  // Non-active statuses (refunded, etc.)
  if (voucher.status !== 'active') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold mb-2">Cannot Redeem</h1>
        <p className="text-white/40 text-sm">This voucher&apos;s status is: {voucher.status}</p>
      </div>
    )
  }

  // Step 1: Verify customer
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>

      <h1 className="text-xl font-semibold mb-6">Redeem Offer</h1>

      <div className="bg-white/5 rounded-xl p-6 mb-6 text-left">
        <p className="text-2xl font-bold text-white text-center mb-4">{voucher.buyer_name}</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-white/40">Offer</span>
            <span className="text-white/70 font-medium">{voucher.offer_title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Salon</span>
            <span className="text-white/70">{voucher.business_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Amount</span>
            <span className="text-white/70">AED {voucher.amount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Offer ID</span>
            <span className="text-white/70">{voucher.purchase_id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 mb-4">{error}</p>
      )}

      <button
        onClick={handleRedeem}
        disabled={redeeming}
        className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-base transition-colors disabled:opacity-50"
      >
        {redeeming ? 'Redeeming...' : 'Confirm'}
      </button>

      <p className="text-xs text-white/30 mt-3">
        Please confirm the client&apos;s identity before redeeming.
      </p>
    </div>
  )
}
