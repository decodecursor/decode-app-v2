import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { getBusinessDisplayName } from '@/lib/user-display'
import PaymentPageClient from '@/components/payment/PaymentPageClient'
import { CheckoutClient } from '@/components/checkout/CheckoutClient'
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

  if (kind === 'listing') {
    const row = await fetchListingByToken(token)
    const data = row ? toCheckoutData(row) : null
    if (!data) return { title: 'Link no longer active' }
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
    const row = await fetchListingByToken(token)
    if (!row) redirect('/expired')
    const data = toCheckoutData(row)
    // already_paid (race with another payer) + missing price/FK data
    // all funnel to the terminal "link no longer active" destination
    // per audit decision #2.
    if (!data || data.already_paid) redirect('/expired')
    const shareUrl = `${getAppBase()}/pay/${token}`
    return <CheckoutClient data={data} shareUrl={shareUrl} />
  }

  if (kind === 'legacy') {
    // Legacy offers flow — unchanged behavior. <PaymentPageClient/>
    // reads params.token (via useParams) and continues to build its
    // existing payload request URL from that UUID.
    return <PaymentPageClient />
  }

  redirect('/expired')
}
