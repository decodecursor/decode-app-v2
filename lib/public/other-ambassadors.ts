/**
 * "Other ambassadors" query — given the professionals featured on a public
 * page, return ALL live ambassadors who feature each of them (including the
 * current page's ambassador), grouped by professional_id. The badge gate
 * (list length > 1) lives in SquadRow, so the current ambassador stays in
 * the list and the modal shows the full squad.
 *
 * ONE grouped query for the whole page (no N+1, no fetch-on-open). The
 * server page collects its professional_ids and calls this once; the result
 * map is attached onto each listing (otherAmbassadors + otherAmbassadorsCount).
 *
 * Fetched server-side with the service-role client (RLS bypassed), so the
 * published / non-suspended visibility filter MUST be applied in code here —
 * RLS won't do it for us. Mirrors §2 of docs/ambassadors-discovery.md.
 */
import type { OtherAmbassador } from '@/lib/public/slug-page-shape'
import type { createServiceRoleClient } from '@/utils/supabase/service-role'

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>

// PostgREST shape — professional_id top-level, the embedded ambassador
// profile (FK model_listings_model_id_fkey) with its user's IG handle
// nested via model_profiles_user_id_fkey.
interface OtherAmbassadorJoinRow {
  professional_id: string
  model_profiles: {
    id: string
    slug: string
    first_name: string
    last_name: string
    cover_photo_url: string | null
    cover_photo_position_y: number | null
    city: string | null
    country: string | null
    is_published: boolean
    is_suspended: boolean
    users: { instagram_handle: string | null } | null
  } | null
}

/**
 * Returns a Map keyed by professional_id → all ambassadors for that pro
 * (sorted by first_name, current ambassador included). Pros with no
 * ambassadors are simply absent from the map (callers default to an empty
 * list). currentModelProfileId is retained on the signature for the gating
 * logic at the call site (badge hides when the current ambassador is the
 * only one).
 */
export async function fetchOtherAmbassadorsByPro(
  admin: ServiceRoleClient,
  professionalIds: string[],
  currentModelProfileId: string,
): Promise<Map<string, OtherAmbassador[]>> {
  void currentModelProfileId
  const byPro = new Map<string, OtherAmbassador[]>()
  if (professionalIds.length === 0) return byPro

  const { data } = await admin
    .from('model_listings_live')
    .select(
      `professional_id,
       model_profiles!model_listings_model_id_fkey (
         id, slug, first_name, last_name, cover_photo_url, cover_photo_position_y,
         city, country,
         is_published, is_suspended,
         users!model_profiles_user_id_fkey ( instagram_handle )
       )`,
    )
    .in('professional_id', professionalIds)
    .in('effective_status', ['active', 'free_trial'])
    .returns<OtherAmbassadorJoinRow[]>()

  // Group by professional_id, applying the visibility filter in code (the
  // service role bypassed RLS) and de-duping ambassadors who list the same
  // pro on more than one listing.
  const seen = new Map<string, Set<string>>()
  for (const row of data ?? []) {
    const mp = row.model_profiles
    if (!mp || !mp.is_published || mp.is_suspended) continue

    const proId = row.professional_id
    let seenSet = seen.get(proId)
    if (!seenSet) {
      seenSet = new Set<string>()
      seen.set(proId, seenSet)
    }
    if (seenSet.has(mp.id)) continue
    seenSet.add(mp.id)

    let list = byPro.get(proId)
    if (!list) {
      list = []
      byPro.set(proId, list)
    }
    list.push({
      id: mp.id,
      slug: mp.slug,
      first_name: mp.first_name,
      last_name: mp.last_name,
      cover_photo_url: mp.cover_photo_url,
      cover_photo_position_y: mp.cover_photo_position_y,
      instagram_handle: mp.users?.instagram_handle ?? null,
      city: mp.city,
      country: mp.country,
    })
  }

  for (const list of byPro.values()) {
    list.sort((a, b) => a.first_name.localeCompare(b.first_name))
  }
  return byPro
}
