'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { USER_ROLES } from '@/types/user'

interface Offer {
  id: string
  title: string
  category: string
  price: number
  original_price: number | null
  quantity: number
  quantity_sold: number
  is_active: boolean
  expires_at: string
  created_at: string
  image_url: string | null
}

export default function ManageOffersPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [offers, setOffers] = useState<Offer[]>([])
  const [deactivating, setDeactivating] = useState<string | null>(null)

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

      // Check business exists
      const { data: business } = await supabase
        .from('beauty_businesses')
        .select('id')
        .eq('creator_id', user.id)
        .single()

      if (!business) {
        setLoading(false)
        return
      }

      // Fetch offers for this business
      const { data: offersData } = await supabase
        .from('beauty_offers')
        .select('id, title, category, price, original_price, quantity, quantity_sold, is_active, expires_at, created_at, image_url')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })

      setOffers(offersData || [])
      setLoading(false)
    }
    init()
  }, [router, supabase])

  const getStatus = (offer: Offer): { label: string; color: string } => {
    if (!offer.is_active) return { label: 'Inactive', color: 'text-gray-400 bg-gray-500/10' }
    if (new Date(offer.expires_at) < new Date()) return { label: 'Expired', color: 'text-yellow-400 bg-yellow-500/10' }
    if (offer.quantity_sold >= offer.quantity) return { label: 'Sold Out', color: 'text-orange-400 bg-orange-500/10' }
    return { label: 'Active', color: 'text-green-400 bg-green-500/10' }
  }

  const handleDeactivate = async (offerId: string) => {
    if (!confirm('Deactivate this offer? Existing purchases remain valid. This cannot be undone.')) return

    setDeactivating(offerId)
    try {
      const { error } = await supabase
        .from('beauty_offers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', offerId)

      if (error) throw error

      setOffers(prev => prev.map(o => o.id === offerId ? { ...o, is_active: false } : o))
    } catch (err: any) {
      console.error('Deactivate error:', err)
      alert('Failed to deactivate offer')
    } finally {
      setDeactivating(null)
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
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white text-sm mb-1 block"
            >
              &larr; Dashboard
            </button>
            <h1 className="text-xl font-semibold text-white">My Offers</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/offers/purchases"
              className="text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg text-sm px-3 py-2.5 transition-colors"
            >
              Purchases
            </Link>
            <Link
              href="/dashboard/offers/create"
              className="bg-gradient-to-br from-gray-800 to-black text-white border border-purple-600 hover:border-purple-700 rounded-lg text-sm font-medium px-4 py-2.5 transition-all hover:scale-[1.02]"
            >
              + New Offer
            </Link>
          </div>
        </div>

        {/* Summary Stats */}
        {offers.length > 0 && (() => {
          const totalSold = offers.reduce((s, o) => s + o.quantity_sold, 0)
          const totalRevenue = offers.reduce((s, o) => s + o.quantity_sold * o.price, 0)
          return (
            <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
              <span>{totalSold} sold</span>
              <span className="text-green-400">{totalRevenue.toLocaleString()} AED revenue</span>
            </div>
          )
        })()}

        {/* Offers List */}
        {offers.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-gray-400 mb-4">No offers yet</p>
            <Link
              href="/dashboard/offers/create"
              className="text-purple-400 hover:text-purple-300 text-sm underline"
            >
              Create your first offer
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => {
              const status = getStatus(offer)
              const revenue = offer.quantity_sold * offer.price

              return (
                <div
                  key={offer.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start gap-4"
                >
                  {/* Thumbnail */}
                  {offer.image_url ? (
                    <img
                      src={offer.image_url}
                      alt={offer.title}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-white font-medium text-sm truncate">{offer.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">{offer.category}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span className="font-medium text-white">{offer.price} AED</span>
                      <span>{offer.quantity_sold}/{offer.quantity} sold</span>
                      {revenue > 0 && <span className="text-green-400">{revenue.toLocaleString()} AED revenue</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  {offer.is_active && new Date(offer.expires_at) > new Date() && (
                    <button
                      onClick={() => handleDeactivate(offer.id)}
                      disabled={deactivating === offer.id}
                      className="text-xs text-red-400 hover:text-red-300 flex-shrink-0 px-2 py-1 border border-red-500/20 rounded hover:border-red-500/40 transition-colors"
                    >
                      {deactivating === offer.id ? '...' : 'Deactivate'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
