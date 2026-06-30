/**
 * Offers query — given the professionals featured on a public page, return
 * each one's single ACTIVE offer, keyed by professional_id.
 *
 * ONE query for the whole page (no N+1). professional_id is UNIQUE in
 * model_professional_offers, so each pro has at most one offer — the map is
 * a straight professional_id → offer, no tie-break needed.
 *
 * Fetched server-side with the service-role client (RLS bypassed), so the
 * is_active filter MUST be applied in code here — the public-read-active RLS
 * policy won't do it for us under the service role.
 */
import type { ProfessionalOffer } from '@/lib/public/slug-page-shape'
import type { createServiceRoleClient } from '@/utils/supabase/service-role'

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>

/**
 * Returns a Map keyed by professional_id → that pro's active offer. Pros
 * with no active offer are simply absent from the map (callers default to
 * null).
 */
export async function fetchOffersByPro(
  admin: ServiceRoleClient,
  professionalIds: string[],
): Promise<Map<string, ProfessionalOffer>> {
  const byPro = new Map<string, ProfessionalOffer>()
  if (professionalIds.length === 0) return byPro

  const { data } = await admin
    .from('model_professional_offers')
    .select('id, professional_id, service, original_price, special_price, perk, valid_until')
    .in('professional_id', professionalIds)
    .eq('is_active', true)
    .returns<ProfessionalOffer[]>()

  for (const offer of data ?? []) {
    byPro.set(offer.professional_id, offer)
  }
  return byPro
}
