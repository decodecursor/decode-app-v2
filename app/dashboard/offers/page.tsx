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
  offer_code: string | null
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
        .select('id, title, category, price, original_price, quantity, quantity_sold, is_active, expires_at, created_at, image_url, offer_code')
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
    <div className="cosmic-bg cosmic-bg-dark min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white text-sm"
            >
              &larr; Back
            </button>
            <div className="flex items-center gap-5">
              <Link
                href="/dashboard/offers/purchases"
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Purchases
              </Link>
              <Link
                href="/dashboard/offers/create"
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Create Offer
              </Link>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-white mt-3">My Offers</h1>
        </div>

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

              return (
                <Link
                  href={`/offers/${offer.id}`}
                  key={offer.id}
                  className="bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-colors p-4 flex items-center gap-4 no-underline block"
                >
                  {/* Thumbnail */}
                  {offer.image_url ? (
                    <img
                      src={offer.image_url}
                      alt={offer.title}
                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}

                  {/* Info Grid */}
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Title</p>
                        <p className="text-xs text-white font-bold truncate">{offer.title}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Price</p>
                        <p className="text-xs text-white font-bold">{offer.price} AED</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Sold</p>
                        <p className="text-xs text-white font-bold">{offer.quantity_sold}/{offer.quantity}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Earned</p>
                        <p className="text-xs text-white font-bold">{offer.quantity_sold * offer.price} AED</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Category</p>
                        <p className="text-xs text-white font-bold truncate capitalize">{offer.category}</p>
                      </div>
                      {offer.offer_code && (
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Code</p>
                          <p className="text-xs text-white font-bold">#{offer.offer_code}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Expires</p>
                        <p className="text-xs text-white font-bold">
                          {(() => {
                            const days = Math.ceil((new Date(offer.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                            if (days < 0) return 'Expired'
                            if (days === 0) return 'Today'
                            return `${days} days`
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Created</p>
                        <p className="text-xs text-white font-bold">{new Date(offer.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Badge + Actions */}
                  <div className="flex flex-col items-end justify-between self-stretch flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                    {offer.is_active && new Date(offer.expires_at) > new Date() && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeactivate(offer.id) }}
                        disabled={deactivating === offer.id}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-500/20 rounded hover:border-red-500/40 transition-colors"
                      >
                        {deactivating === offer.id ? '...' : 'Deactivate'}
                      </button>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
