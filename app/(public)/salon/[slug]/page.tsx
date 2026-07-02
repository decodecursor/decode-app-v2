import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { fetchOtherAmbassadorsByPro } from '@/lib/public/other-ambassadors'
import { SalonPage, type SalonData } from '@/components/public/salon/SalonPage'

/**
 * Salon-ONLY route, reached exclusively via the trustedby.net rewrite in
 * middleware.ts (trustedby.net/{slug} → /salon/{slug}). It NEVER falls back
 * to the ambassador page: the slug must resolve to a model_professionals row,
 * otherwise the visitor is sent to the main site. The public salon UI itself
 * is the exact same <SalonPage> the /{slug} route renders — only the share
 * URL differs (it uses the request host, so links stay on trustedby.net).
 *
 * Additive: welovedecode.com never rewrites here. If this route is somehow
 * hit on another host, it hands back to the canonical /{slug} page.
 */

export const dynamic = 'force-dynamic'
export const dynamicParams = true

const TRUSTEDBY_HOSTS = new Set(['trustedby.net', 'www.trustedby.net'])
const MAIN_SITE = 'https://welovedecode.com'

async function fetchSalon(slug: string): Promise<SalonData | null> {
  const admin = createServiceRoleClient()
  const { data } = await admin
    .from('model_professionals')
    .select('id, slug, name, city, country, instagram_handle, cover_photo_url')
    .eq('slug', slug)
    .maybeSingle<SalonData>()
  return data ?? null
}

function hostFrom(h: Headers): string {
  return (h.get('host') || '').toLowerCase().split(':')[0]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const salon = await fetchSalon(slug)
  if (!salon) return { title: 'WeLoveDecode' }
  const salonImages = salon.cover_photo_url ? [{ url: salon.cover_photo_url }] : undefined
  const description = 'Trusted by...'
  return {
    title: salon.name,
    description,
    openGraph: { title: salon.name, description, images: salonImages },
    twitter: {
      card: 'summary_large_image',
      title: salon.name,
      description,
      images: salon.cover_photo_url ? [salon.cover_photo_url] : undefined,
    },
  }
}

export default async function TrustedBySalonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const host = hostFrom(await headers())

  // Only serves the trustedby host (arrives here via middleware rewrite). On
  // any other host, hand back to the canonical /{slug} page.
  if (!TRUSTEDBY_HOSTS.has(host)) {
    redirect(`/${slug}`)
  }

  // Salon-only resolution — no ambassador fallback. Unknown / ambassador
  // slug → main site (keeps the slug so the ambassador page resolves there).
  const salon = await fetchSalon(slug)
  if (!salon) {
    redirect(`${MAIN_SITE}/${slug}`)
  }

  const admin = createServiceRoleClient()
  // REUSE the existing trusted-by query to list every ambassador with a live
  // listing for this salon (mirrors the /{slug} salon branch).
  const ambassadors =
    (await fetchOtherAmbassadorsByPro(admin, [salon.id], salon.id)).get(salon.id) ?? []

  // Share the trustedby.net/{slug} URL — use the request host, not a domain.
  const shareUrl = `https://${host}/${salon.slug}`

  return <SalonPage salon={salon} ambassadors={ambassadors} shareUrl={shareUrl} />
}
