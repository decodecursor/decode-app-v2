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
import { getPlaceDataForProfessional } from '@/lib/public/google-places'
import { getSummaryForProfessional } from '@/lib/public/gemini-summary'
import { fetchOtherAmbassadorsByPro } from '@/lib/public/other-ambassadors'
import { fetchOffersByPro } from '@/lib/public/offers'

// Cache freshness thresholds. Mirrored from the helpers in lib/public — we
// peek at the *_at timestamps here to decide whether to call the helper at
// all (cold path triggers a sync fetch, stale path triggers fire-and-forget
// refresh inside the helper). A fresh cache row needs no helper call.
const PLACES_TTL_MS = 24 * 60 * 60 * 1000
const GEMINI_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Trust Stack messaged_30d window — single source of truth here.
const MESSAGED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

// Request-time dynamic (not ISR-cached) so the "other ambassadors" count on
// each card stays live — a newly-published ambassador for a shared pro must
// surface its badge immediately, which a 60s edge cache would stale out.
export const dynamic = 'force-dynamic'
export const dynamicParams = true

type ProfileRow = PublicProfile & {
  is_published: boolean
  is_suspended: boolean
}

// Joined shape returned by PostgREST — the embedded users() select
// nests instagram_handle under .users. fetchProfile flattens it onto
// the row so the rest of the page reads a single shape.
type RawProfileRow = Omit<ProfileRow, 'instagram_handle'> & {
  users: { instagram_handle: string | null } | null
}

async function fetchProfile(slug: string): Promise<ProfileRow | null> {
  const admin = createServiceRoleClient()
  const { data } = await admin
    .from('model_profiles')
    .select(
      'id, slug, first_name, last_name, tagline, cover_photo_url, cover_photo_position_y, gifts_enabled, is_published, is_suspended, users!model_profiles_user_id_fkey ( instagram_handle )',
    )
    .eq('slug', slug)
    .maybeSingle<RawProfileRow>()
  if (!data) return null
  const { users, ...rest } = data
  return { ...rest, instagram_handle: users?.instagram_handle ?? null }
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
  const title = displayName
  const description = 'My Beauty Squad'
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

  const rawRows = rows ?? []

  // Trust Stack refresh: walk each row's embedded professional and decide
  // whether to call the cache-aware helpers. Cold path (no cache row) fetches
  // synchronously so the first render has data; stale path returns the
  // existing cache immediately and fires a fire-and-forget background refresh
  // inside the helper. Fresh cache → no helper call. Per-professional dedupe
  // (a single ambassador can list the same professional twice) is handled by
  // tracking which IDs we've already invoked the helper for.
  const seenPlaces = new Set<string>()
  const seenSummary = new Set<string>()
  const now = Date.now()
  await Promise.all(
    rawRows.flatMap((row) => {
      const prof = row.model_professionals
      if (!prof) return []
      const tasks: Array<Promise<unknown>> = []

      if (prof.google_place_id && !seenPlaces.has(prof.id)) {
        const cachedAt = prof.google_places_cached_at
          ? new Date(prof.google_places_cached_at).getTime()
          : null
        const needsRefresh =
          !prof.google_places_cache || cachedAt == null || now - cachedAt > PLACES_TTL_MS
        if (needsRefresh) {
          seenPlaces.add(prof.id)
          // getPlaceDataForProfessional self-fires the background refresh on
          // the stale path and only blocks on cold-path. Both are fine to
          // await here in the Promise.all — the helper already non-awaits
          // its own refresh internally, so this await resolves immediately
          // when the cache row exists.
          tasks.push(getPlaceDataForProfessional(admin, prof.id, prof.google_place_id))
        }
      }

      if (prof.google_place_id && !seenSummary.has(prof.id)) {
        const generatedAt = prof.review_summary_generated_at
          ? new Date(prof.review_summary_generated_at).getTime()
          : null
        const summaryStale =
          !prof.review_summary_gemini ||
          generatedAt == null ||
          now - generatedAt > GEMINI_TTL_MS
        if (summaryStale) {
          // Gemini needs reviews from the Places cache to summarise. Pull
          // them from the row's existing cache (or empty list — the helper
          // no-ops on empty cold path). The freshly-refreshed cache from
          // the Places helper above is not awaited for this read; this
          // pass uses whatever was already on the row at fetch time, so
          // first-cold-render skips the summary and the next ISR rebuild
          // picks it up. Acceptable per §6.2 graceful degradation.
          const placeReviews = Array.isArray(prof.google_places_cache?.reviews)
            ? (prof.google_places_cache!.reviews as Array<{
                rating?: number
                text?: { text?: string }
              }>)
                .filter((r) => typeof r.rating === 'number' && !!r.text?.text)
                .map((r) => ({ rating: r.rating as number, text: r.text!.text as string }))
            : []
          seenSummary.add(prof.id)
          tasks.push(
            getSummaryForProfessional(admin, prof.id, prof.name, placeReviews),
          )
        }
      }
      return tasks
    }),
  )

  const listings = rawRows.map(toPublicListing).filter((l) => l !== null)

  // messaged_30d aggregation — SINGLE grouped query for ALL listings on the
  // page (not N queries). Filter by event_type IN (badge, modal) + target_id
  // IN (listingIds) + created_at >= 30d ago, then group by target_id in JS:
  // count + max(created_at). Postgres planner uses
  // idx_model_analytics_events_target_id (partial) + an event_type/created_at
  // pre-filter on small candidate sets, which is fine at expected volumes.
  const listingIds = listings.map((l) => l.id)
  if (listingIds.length > 0) {
    const thirtyDaysAgo = new Date(now - MESSAGED_WINDOW_MS).toISOString()
    const { data: events } = await admin
      .from('model_analytics_events')
      .select('target_id, created_at')
      .in('event_type', ['listing_whatsapp_badge_click', 'listing_whatsapp_modal_click'])
      .in('target_id', listingIds)
      .gte('created_at', thirtyDaysAgo)
      .returns<Array<{ target_id: string | null; created_at: string }>>()

    const aggMap = new Map<string, { count: number; lastAt: string }>()
    for (const ev of events ?? []) {
      if (!ev.target_id) continue
      const prev = aggMap.get(ev.target_id)
      if (!prev) {
        aggMap.set(ev.target_id, { count: 1, lastAt: ev.created_at })
      } else {
        prev.count += 1
        if (ev.created_at > prev.lastAt) prev.lastAt = ev.created_at
      }
    }

    for (const l of listings) {
      const agg = aggMap.get(l.id)
      if (agg) {
        l.messaged_30d = agg.count
        l.last_msg_at = agg.lastAt
      }
    }
  }

  // "Other ambassadors" — ONE grouped query across the page's professional
  // ids for ALL live ambassadors featuring each pro (current ambassador
  // included). Service-role fetch bypasses RLS, so the helper applies the
  // published/non-suspended filter in code. Attach per-listing so the modal
  // reads the full list with no fetch-on-open; the badge gates on the list
  // length (> 1). otherAmbassadorsCount holds the OTHERS count.
  const professionalIds = Array.from(new Set(listings.map((l) => l.professional_id)))
  const otherAmbassadorsByPro = await fetchOtherAmbassadorsByPro(
    admin,
    professionalIds,
    profile.id,
  )
  for (const l of listings) {
    const all = otherAmbassadorsByPro.get(l.professional_id) ?? []
    l.otherAmbassadors = all
    l.otherAmbassadorsCount = all.filter((a) => a.id !== profile.id).length
  }

  // Offers — ONE grouped query across the page's professional ids for each
  // pro's single ACTIVE offer (professional_id is UNIQUE, so at most one).
  // Service-role bypasses RLS, so the helper keeps the is_active filter
  // explicit in code. Attach per-listing (null when the pro has none); the
  // gift icon + OfferModal read listing.offer directly (no fetch-on-open).
  const offersByPro = await fetchOffersByPro(admin, professionalIds)
  for (const l of listings) {
    l.offer = offersByPro.get(l.professional_id) ?? null
  }

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
          instagram_handle: profile.instagram_handle,
        },
        listings,
      }}
      shareUrl={shareUrl}
    />
  )
}
