/**
 * Public offers data layer
 * Uses public_active_offers VIEW — all safety filters enforced at DB level
 */
import { createClient } from '@/utils/supabase/client'

export interface PublicOffer {
  id: string
  business_id: string
  created_by: string
  title: string
  description: string | null
  category: string
  price: number
  original_price: number | null
  quantity: number
  quantity_sold: number
  image_url: string | null
  offer_code: string
  is_active: boolean
  expires_at: string
  created_at: string
  updated_at: string
  // Joined from beauty_businesses
  business_name: string
  business_photo_url: string | null
  city: string | null
  google_rating: number | null
  google_reviews_count: number | null
  whatsapp_number: string | null
  instagram_handle: string | null
}

const PAGE_SIZE = 20

export async function getPublicOffers(offset = 0, limit = PAGE_SIZE, category?: string, city?: string) {
  const supabase = createClient()
  let query = supabase
    .from('public_active_offers')
    .select('*')

  if (category && category !== 'All') {
    query = query.ilike('category', category)
  }

  if (city && city !== 'UAE') {
    query = query.ilike('city', city)
  }

  return query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
}

export async function getOfferById(id: string) {
  const supabase = createClient()
  return supabase
    .from('public_active_offers')
    .select('*')
    .eq('id', id)
    .single()
}

export function getOfferImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null
  if (imagePath.startsWith('http')) return imagePath
  const supabase = createClient()
  const { data } = supabase.storage
    .from('offer-images')
    .getPublicUrl(imagePath)
  return data.publicUrl
}

export function getBusinessLogoUrl(photoUrl: string | null): string | null {
  if (!photoUrl) return null
  // business_photo_url may already be a full URL or a storage path
  if (photoUrl.startsWith('http')) return photoUrl
  const supabase = createClient()
  const { data } = supabase.storage
    .from('offer-images')
    .getPublicUrl(photoUrl)
  return data.publicUrl
}

export function getDaysUntilExpiry(expiresAt: string): number {
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diff = expiry.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function getQuantityRemaining(offer: PublicOffer): number {
  return offer.quantity - offer.quantity_sold
}
