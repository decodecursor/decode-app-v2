import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import PublicPageClient from '@/components/public/PublicPageClient'
import {
  PUBLIC_LISTING_SELECT,
  toPublicListing,
  type LiveListingJoinRow,
  type PublicProfile,
} from '@/lib/public/slug-page-shape'

// Incremental Static Regeneration — public pages are high-traffic, data
// changes slowly (new listings, edits). 60s revalidate balances freshness
// vs edge-cache hit rate. Slice 3C listing edits + 4B payment webhooks
// will on-demand revalidate in later slices if staler windows emerge.
export const revalidate = 60
export const dynamicParams = true

type ProfileRow = PublicProfile & {
  is_published: boolean
  is_suspended: boolean
}

async function fetchProfile(slug: string): Promise<ProfileRow | null> {
  const admin = createServiceRoleClient()
  const { data } = await admin
    .from('model_profiles')
    .select(
      'id, slug, first_name, last_name, tagline, cover_photo_url, cover_photo_position_y, gifts_enabled, is_published, is_suspended',
    )
    .eq('slug', slug)
    .maybeSingle<ProfileRow>()
  return data ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const profile = await fetchProfile(slug)
  if (!profile || !profile.is_published || profile.is_suspended) {
    return { title: 'WeLoveDecode' }
  }
  const displayName = `${profile.first_name} ${profile.last_name}`.trim()
  const title = `${displayName} — WeLoveDecode`
  const description = profile.tagline ?? `${displayName}'s Beauty Squad on WeLoveDecode.`
  const coverImages = profile.cover_photo_url ? [{ url: profile.cover_photo_url }] : undefined
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: coverImages,
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: profile.cover_photo_url ? [profile.cover_photo_url] : undefined,
    },
  }
}

export default async function PublicSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const profile = await fetchProfile(slug)
  if (!profile || !profile.is_published || profile.is_suspended) notFound()

  const admin = createServiceRoleClient()
  // Listings projection — effective_status filters out date-expired rows
  // even before any background job runs. Public view hides pending_payment
  // (professional hasn't paid yet) and expired. Order newest-first.
  const { data: rows } = await admin
    .from('model_listings_live')
    .select(PUBLIC_LISTING_SELECT)
    .eq('model_id', profile.id)
    .in('effective_status', ['active', 'free_trial'])
    .order('created_at', { ascending: false })
    .returns<LiveListingJoinRow[]>()

  const listings = (rows ?? []).map(toPublicListing).filter((l) => l !== null)

  // Canonical share URL. Apex still on Carrd per PROJECT_STATE decision
  // #7 — until apex migrates, the share link points at the app subdomain
  // via NEXT_PUBLIC_APP_URL. Fallback matches sibling app-base fallbacks
  // (UrlOverlay, StripeElementsForm, pay/[token], notification-stubs):
  // app subdomain, NOT the apex (apex 404s on /{slug}).
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://app.welovedecode.com'
  const shareUrl = `${appOrigin}/${profile.slug}`

  return (
    <PublicPageClient
      data={{
        profile: {
          id: profile.id,
          slug: profile.slug,
          first_name: profile.first_name,
          last_name: profile.last_name,
          tagline: profile.tagline,
          cover_photo_url: profile.cover_photo_url,
          cover_photo_position_y: profile.cover_photo_position_y,
          gifts_enabled: profile.gifts_enabled,
        },
        listings,
      }}
      shareUrl={shareUrl}
    />
  )
}
