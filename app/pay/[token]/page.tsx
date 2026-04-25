import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { getBusinessDisplayName } from '@/lib/user-display'
import PaymentPageClient from '@/components/payment/PaymentPageClient'
import { CheckoutClient } from '@/components/checkout/CheckoutClient'
import {
  WishCheckoutClient,
  type WishCheckoutWish,
  type WishCheckoutAmbassador,
} from '@/components/checkout/WishCheckoutClient'
import {
  CHECKOUT_LISTING_SELECT,
  classifyToken,
  toCheckoutData,
  ambassadorDisplayName,
  type CheckoutListingRow,
  type DispatchKind,
} from '@/lib/checkout/checkout-shape'

/**
 * /pay/[token] dispatch server component.
 *
 * Single route resolves two shapes (Slice 4 locked decision #2):
 *   - 8-char alphanumeric → ambassador listing (checkout page)
 *   - UUID → legacy offers payment (unchanged <PaymentPageClient/>)
 *   - anything else → expired / not-found
 *
 * The folder parameter is named `token` (renamed from the legacy
 * `linkId`). PaymentPageClient.tsx is updated in the same commit so its
 * useParams() still resolves the value. All other legacy URL builders
 * continue to write `/pay/{uuid}` paths untouched.
 *
 * No ISR here — checkout state must reflect payment-status reality on
 * every request. Listing payload is fetched via service-role because
 * public RLS on model_listings hides pending_payment + expired rows.
 *
 * Expired fallback: redirect('/expired') for all listings-branch
 * failure modes (missing row, already-paid, missing FK/prices) and
 * for invalid token shapes. The expired page (app/(public)/expired)
 * ships the neutral "Link no longer active" terminal state per spec.
 */

function getAppBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.welovedecode.com').replace(/\/$/, '')
}

async function fetchListingByToken(token: string): Promise<CheckoutListingRow | null> {
  const admin = createServiceRoleClient()
  const { data, error } = await admin
    .from('model_listings')
    .select(CHECKOUT_LISTING_SELECT)
    .eq('payment_link_token', token)
    .maybeSingle<CheckoutListingRow>()
  if (error) {
    console.error('[/pay dispatch] Listing lookup failed:', error)
    return null
  }
  return data
}

interface WishLookupRow {
  id: string
  payment_link_token: string
  service_name: string
  professional_name: string | null
  professional_city: string | null
  professional_country: string | null
  price: number | string
  currency: string
  status: 'available' | 'taken'
  effective_status: 'available' | 'taken'
  profile: {
    slug: string
    first_name: string
    last_name: string | null
    cover_photo_url: string | null
    tagline: string | null
  } | null
}

interface WishDispatchData {
  wish: WishCheckoutWish
  ambassador: WishCheckoutAmbassador
}

async function fetchWishByToken(token: string): Promise<WishDispatchData | null> {
  const admin = createServiceRoleClient()
  // Read from model_wishes_live so effective_status reflects the cron-
  // released state immediately (a stale 'taken' lock with expired
  // payment_attempt_expires_at and no payment row reads as 'available').
  const { data, error } = await admin
    .from('model_wishes_live')
    .select(`
      id, payment_link_token, service_name,
      professional_name, professional_city, professional_country,
      price, currency, status, effective_status,
      profile:model_profiles!model_wishes_model_id_fkey (
        slug, first_name, last_name, cover_photo_url, tagline
      )
    `)
    .eq('payment_link_token', token)
    .maybeSingle<WishLookupRow>()

  if (error) {
    console.error('[/pay dispatch] Wish lookup failed:', error)
    return null
  }
  if (!data) return null
  if (!data.profile) return null
  // Already gifted → terminal /wish/taken page rather than checkout.
  // We use effective_status (not raw status) so a stale lock that's
  // expired but not yet swept by revert_expired_wish_locks() is still
  // shown as available — matches what the wishlist UI would show.
  if (data.effective_status !== 'available') return null

  return {
    wish: {
      id: data.id,
      payment_link_token: data.payment_link_token,
      service_name: data.service_name,
      professional_name: data.professional_name,
      professional_city: data.professional_city,
      professional_country: data.professional_country,
      price: typeof data.price === 'string' ? Number(data.price) : data.price,
      currency: data.currency,
    },
    ambassador: {
      slug: data.profile.slug,
      first_name: data.profile.first_name,
      last_name: data.profile.last_name,
      cover_photo_url: data.profile.cover_photo_url,
      tagline: data.profile.tagline,
    },
  }
}

interface LegacyLinkRow {
  id: string
  client_name: string | null
  expiration_date: string
  is_active: boolean
  creator_id: string
}

interface LegacyCreatorRow {
  id: string
  user_name: string | null
  email: string | null
  professional_center_name?: string | null
  company_name: string | null
}

async function fetchLegacyMetadata(token: string): Promise<{ clientName: string; companyName: string } | null> {
  const admin = createServiceRoleClient()
  const { data: link } = await admin
    .from('payment_links')
    .select('id, client_name, expiration_date, is_active, creator_id')
    .eq('id', token)
    .maybeSingle<LegacyLinkRow>()
  if (!link || !link.is_active) return null
  if (new Date() > new Date(link.expiration_date)) return null

  const { data: creator } = await admin
    .from('users')
    .select('id, user_name, email, professional_center_name, company_name')
    .eq('id', link.creator_id)
    .maybeSingle<LegacyCreatorRow>()
  if (!creator) return null

  return {
    clientName: link.client_name ?? 'you',
    companyName: getBusinessDisplayName(creator) ?? 'our salon',
  }
}

function legacyMetadata(token: string, clientName?: string, companyName?: string): Metadata {
  const base = getAppBase()
  const title = "It's Pamper Time"
  const description = clientName && companyName
    ? `Gift ${clientName} with a Beauty Service at ${companyName}`
    : 'A special beauty treatment awaits you'
  const url = `${base}/pay/${token}`
  const logo = `${base}/logonew.png`
  return {
    title,
    openGraph: { title, type: 'website', description, url, images: [{ url: logo, width: 1200, height: 630, alt: 'DECODE' }] },
    twitter: { card: 'summary_large_image', title, images: [logo] },
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const kind: DispatchKind = classifyToken(token)

  // Slice 5C: 8-char base64url shape is shared between listings and
  // wishes (both use randomBytes(6).toString('base64url')). classifyToken
  // returns 'listing' for the shape; we try the listings table first,
  // then fall back to the wishes table.
  if (kind === 'listing') {
    const row = await fetchListingByToken(token)
    if (row) {
      const data = toCheckoutData(row)
      if (data) {
        const name = ambassadorDisplayName(data.ambassador)
        const title = `Join ${name}'s Beauty Squad`
        const description = data.ambassador.tagline ?? `Get listed on ${name}'s page`
        const url = `${getAppBase()}/pay/${token}`
        const images = data.ambassador.cover_photo_url
          ? [{ url: data.ambassador.cover_photo_url, width: 1200, height: 630, alt: name }]
          : undefined
        return {
          title,
          openGraph: { title, type: 'website', description, url, images },
          twitter: { card: 'summary_large_image', title, images: data.ambassador.cover_photo_url ? [data.ambassador.cover_photo_url] : undefined },
        }
      }
    }

    // Not a listing → try wish.
    const wishData = await fetchWishByToken(token)
    if (wishData) {
      const name = `${wishData.ambassador.first_name}${wishData.ambassador.last_name ? ' ' + wishData.ambassador.last_name : ''}`
      const title = `Gift ${wishData.ambassador.first_name} a beauty wish`
      const description = `Make ${wishData.ambassador.first_name}'s beauty wish come true`
      const url = `${getAppBase()}/pay/${token}`
      const images = wishData.ambassador.cover_photo_url
        ? [{ url: wishData.ambassador.cover_photo_url, width: 1200, height: 630, alt: name }]
        : undefined
      return {
        title,
        openGraph: { title, type: 'website', description, url, images },
        twitter: { card: 'summary_large_image', title, images: wishData.ambassador.cover_photo_url ? [wishData.ambassador.cover_photo_url] : undefined },
      }
    }

    return { title: 'Link no longer active' }
  }

  if (kind === 'legacy') {
    const m = await fetchLegacyMetadata(token)
    return legacyMetadata(token, m?.clientName, m?.companyName)
  }

  return { title: 'Link no longer active' }
}

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const kind: DispatchKind = classifyToken(token)

  if (kind === 'listing') {
    // Try listings first (hot path — V1 traffic is dominantly listings).
    const row = await fetchListingByToken(token)
    if (row) {
      const data = toCheckoutData(row)
      // already_paid (race with another payer) + missing price/FK data
      // all funnel to the terminal "link no longer active" destination
      // per audit decision #2.
      if (!data || data.already_paid) redirect('/expired')
      const shareUrl = `${getAppBase()}/pay/${token}`
      return <CheckoutClient data={data} shareUrl={shareUrl} />
    }

    // Not a listing — fall through to wish lookup. Same 8-char shape;
    // wishes are stored in a different table with a different UNIQUE
    // index, so a token can match at most one of the two.
    const wishData = await fetchWishByToken(token)
    if (wishData) {
      const shareUrl = `${getAppBase()}/${wishData.ambassador.slug}`
      return (
        <WishCheckoutClient
          wish={wishData.wish}
          ambassador={wishData.ambassador}
          shareUrl={shareUrl}
        />
      )
    }

    redirect('/expired')
  }

  if (kind === 'legacy') {
    // Legacy offers flow — unchanged behavior. <PaymentPageClient/>
    // reads params.token (via useParams) and continues to build its
    // existing payload request URL from that UUID.
    return <PaymentPageClient />
  }

  redirect('/expired')
}
