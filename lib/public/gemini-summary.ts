/**
 * Gemini review summariser + 7d cache
 *
 * Model: gemini-1.5-flash — the fastest/cheapest tier; a 1–3 sentence review
 * summary is a low-complexity task that does not need a larger model.
 * Endpoint:
 *   POST https://generativelanguage.googleapis.com/v1beta/models/
 *        gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}
 * Request body shape: { contents: [{ parts: [{ text: prompt }] }] }
 *
 * Cache: the generated summary is stored on
 *   model_professionals.review_summary_gemini, with
 *   model_professionals.review_summary_generated_at driving a 7d TTL.
 *
 * Graceful failure: on any API or parse error the cache-aware entry point
 * logs and returns null — the caller (Pro Info modal) then hides the AI
 * summary section entirely per spec §6.2 graceful degradation.
 *
 * Env: GEMINI_API_KEY is registered optional in env-validation.ts — this
 * module imports fine without it and throws only at first fetch.
 *
 * Direct REST fetch is used deliberately: a single call per salon does not
 * justify adding the @google/generative-ai SDK as a dependency.
 */

import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { logger } from '@/lib/logger'

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

type PlaceReviewInput = { rating: number; text: string }

function buildPrompt(displayName: string, reviews: PlaceReviewInput[]): string {
  const reviewBlock = reviews.map((r) => `${r.rating}/5: ${r.text}`).join('\n')
  return `Summarize the following Google reviews for ${displayName} in one to three short, neutral sentences. Focus on what customers consistently mention. Avoid marketing language and exclamations. Reviews:\n\n${reviewBlock}`
}

/**
 * Fresh call to Gemini. Throws on missing API key, network failure, non-2xx
 * response, or a body without summary text. The caller decides whether to
 * swallow the error or propagate it.
 */
export async function generateSummaryFromGemini(
  displayName: string,
  reviews: Array<{ rating: number; text: string }>,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const prompt = buildPrompt(displayName, reviews)
  const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Gemini request failed (${res.status} ${res.statusText}): ${body.slice(0, 300)}`,
    )
  }

  const data = (await res.json().catch(() => null)) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  } | null

  const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!summary) {
    throw new Error('Gemini returned no summary text')
  }
  return summary
}

async function writeSummaryCache(
  supabase: ServiceRoleClient,
  professionalId: string,
  summary: string,
): Promise<void> {
  const { error } = await supabase
    .from('model_professionals')
    .update({
      review_summary_gemini: summary,
      review_summary_generated_at: new Date().toISOString(),
    })
    .eq('id', professionalId)
  if (error) {
    logger.error('[gemini-summary] cache write failed', professionalId, error.message)
  }
}

/**
 * Top-level entry point. Reads the cached summary + its age:
 *   - fresh cache → returned as-is
 *   - stale cache → returned immediately; a background refresh is fired
 *                   (not awaited) to rewrite the column
 *   - no cache    → cold path: call Gemini synchronously, write back, return it
 *
 * Returns null on any error (and on the cold path when there are no reviews
 * to summarise) — the caller hides the AI summary section.
 */
export async function getSummaryForProfessional(
  supabase: ServiceRoleClient,
  professionalId: string,
  displayName: string,
  placeReviews: Array<{ rating: number; text: string }>,
): Promise<string | null> {
  const { data: row, error } = await supabase
    .from('model_professionals')
    .select('review_summary_gemini, review_summary_generated_at')
    .eq('id', professionalId)
    .maybeSingle<{
      review_summary_gemini: string | null
      review_summary_generated_at: string | null
    }>()

  if (error) {
    logger.error('[gemini-summary] cache read failed', professionalId, error.message)
  }

  const cache = row?.review_summary_gemini ?? null
  const generatedAt = row?.review_summary_generated_at
    ? new Date(row.review_summary_generated_at).getTime()
    : null

  if (cache && generatedAt != null) {
    const isStale = Date.now() - generatedAt > CACHE_TTL_MS
    if (isStale && placeReviews.length > 0) {
      // Fire-and-forget background refresh — caller is not blocked.
      void generateSummaryFromGemini(displayName, placeReviews)
        .then((fresh) => writeSummaryCache(supabase, professionalId, fresh))
        .catch((err) => {
          logger.warn('[gemini-summary] background refresh failed', professionalId, err)
        })
    }
    return cache
  }

  // Cold path — no cached summary. Nothing to summarise without reviews.
  if (placeReviews.length === 0) {
    return null
  }

  try {
    const fresh = await generateSummaryFromGemini(displayName, placeReviews)
    await writeSummaryCache(supabase, professionalId, fresh)
    return fresh
  } catch (err) {
    logger.warn('[gemini-summary] cold-path generation failed', professionalId, err)
    return null
  }
}
