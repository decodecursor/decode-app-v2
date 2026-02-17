'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { USER_ROLES } from '@/types/user'

type FilterTab = 'all' | 'active' | 'redeemed' | 'refunded'

interface Purchase {
  id: string
  status: string
  amount_paid: number
  created_at: string
  redeemed_at: string | null
  beauty_offers: { title: string }
  users: { user_name: string | null }
}

export default function PurchasesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')

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

      const { data: business } = await supabase
        .from('beauty_businesses')
        .select('id')
        .eq('creator_id', user.id)
        .single()

      if (!business) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('beauty_purchases')
        .select(`id, status, amount_paid, created_at, redeemed_at,
          beauty_offers!inner(title),
          users!beauty_purchases_buyer_id_fkey(user_name)`)
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })

      setPurchases((data as unknown as Purchase[]) || [])
      setLoading(false)
    }
    init()
  }, [router, supabase])

  const filtered = purchases.filter((p) => {
    if (filter === 'all') return true
    if (filter === 'active') return p.status === 'active'
    if (filter === 'redeemed') return p.status === 'redeemed'
    if (filter === 'refunded') return p.status === 'refunded'
    return true
  })

  const totalRevenue = purchases
    .filter(p => p.status !== 'refunded')
    .reduce((sum, p) => sum + Number(p.amount_paid), 0)
  const totalSold = purchases.filter(p => p.status !== 'refunded').length
  const totalRedeemed = purchases.filter(p => p.status === 'redeemed').length
  const totalActive = purchases.filter(p => p.status === 'active').length

  const getStatusBadge = (p: Purchase) => {
    if (p.status === 'refunded') return { label: 'Refunded', color: 'text-red-400 bg-red-500/10' }
    if (p.status === 'redeemed') return { label: 'Redeemed', color: 'text-blue-400 bg-blue-500/10' }
    return { label: 'Active', color: 'text-green-400 bg-green-500/10' }
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'redeemed', label: 'Redeemed' },
    { key: 'refunded', label: 'Refunded' },
  ]

  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    )
  }

  return (
    <div className="cosmic-bg cosmic-bg-dark min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/offers"
            className="text-gray-400 hover:text-white text-sm mb-1 block"
          >
            &larr; Back
          </Link>
          <h1 className="text-xl font-semibold text-white">Purchases</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Revenue', value: `${totalRevenue.toLocaleString()} AED` },
            { label: 'Sold', value: totalSold },
            { label: 'Redeemed', value: totalRedeemed },
            { label: 'Active', value: totalActive },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-white font-semibold text-lg">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                filter === t.key
                  ? 'bg-[#E1306C] border-[#E1306C] text-white'
                  : 'border-white/10 text-white/60 hover:border-[#E1306C]/40 hover:text-white/90'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Purchases List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400">No purchases yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => {
              const badge = getStatusBadge(p)
              const buyerName = p.users?.user_name || 'Unknown buyer'
              const offerTitle = p.beauty_offers?.title || 'Unknown offer'

              return (
                <div
                  key={p.id}
                  className="relative bg-white/5 border border-white/10 rounded-xl p-3 md:p-4"
                >
                  <span className={`absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                  <div className="grid grid-cols-3 landscape:grid-cols-5 md:grid-cols-5 gap-[1px] landscape:gap-[2px] md:gap-[6px] max-w-2xl">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Offer</p>
                      <p className="text-xs text-white font-bold truncate">{offerTitle}</p>
                    </div>
                    <div className="hidden landscape:block md:block">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Buyer</p>
                      <p className="text-xs text-white font-bold truncate">{buyerName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Amount</p>
                      <p className="text-xs text-white font-bold">{Number(p.amount_paid).toLocaleString()} AED</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Purchased</p>
                      <p className="text-xs text-white font-bold">{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="hidden landscape:block md:block">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Redeemed</p>
                      <p className="text-xs text-white font-bold">{p.redeemed_at ? new Date(p.redeemed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
