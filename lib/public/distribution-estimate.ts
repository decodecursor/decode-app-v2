/**
 * J-curve rating histogram estimator — V1 PLACEHOLDER
 *
 * Google's standard Places API does NOT expose 5-bucket rating distribution
 * counts. This helper produces a self-consistent approximation anchored to the
 * two real numbers Google does return: rating (averaged) and userRatingCount
 * (total).
 *
 * Returns a 5-element tuple indexed by (star value - 1):
 *   [c1, c2, c3, c4, c5] where c_n = approx count of n-star ratings
 *
 * Algorithm: assume a typical Google reviews J-curve shape (5-star dominant,
 * secondary 1-star peak, sparse middle), then anchor proportions so the
 * resulting bucket counts sum to userRatingCount AND produce the real rating
 * (within tolerance of 0.05).
 *
 * V2 SWAP PATH:
 *   When model_professionals.google_business_profile_id is populated (pro
 *   Google OAuth claim), call the Google Business Profile Performance API for
 *   the real histogram. Output shape stays identical (5-element tuple), so
 *   consumer JSX in ProInfoModal needs zero changes. Replace the body of
 *   estimateRatingHistogram; call sites are forward-compatible.
 *
 * Worked example: rating=4.7, total=156 → [2, 3, 7, 22, 122]
 *   sum=156 ✓; weighted avg = (122×5 + 22×4 + 7×3 + 3×2 + 2×1)/156 = 4.66 ≈ 4.7 ✓
 */

// Typical Google-reviews J-curve shape: 5-star dominant, secondary 1-star
// bump, sparse middle. Sums to 1.0; its own weighted average is ~4.66, so
// the iterative step below only has to nudge from there to the real rating.
const J_CURVE_WEIGHTS = [0.013, 0.02, 0.045, 0.14, 0.782] as const

// Anchor tolerance: stop shifting mass once the histogram's weighted average
// is within this of the real Google rating.
const RATING_TOLERANCE = 0.05

function weightedAverage(buckets: number[], total: number): number {
  let acc = 0
  for (let i = 0; i < 5; i++) acc += (i + 1) * buckets[i]
  return acc / total
}

export function estimateRatingHistogram(
  rating: number | null | undefined,
  totalCount: number | null | undefined,
): [number, number, number, number, number] | null {
  // Null/0 guard — without both real anchors there is nothing to estimate.
  if (
    rating == null ||
    totalCount == null ||
    !Number.isFinite(rating) ||
    !Number.isFinite(totalCount) ||
    totalCount <= 0
  ) {
    return null
  }

  // Step 1+2: scale the J-curve shape by the real total → float bucket counts.
  const buckets = J_CURVE_WEIGHTS.map((w) => w * totalCount)

  // Step 3: iteratively shift mass between adjacent buckets until the weighted
  // average lands within tolerance of the real rating. Moving `m` mass up one
  // bucket raises the average by exactly m/total (and down lowers it likewise),
  // independent of which adjacent pair — so we always pull from the lowest
  // non-empty bucket (to raise) or highest non-empty bucket (to lower).
  const step = Math.max(totalCount * 0.002, 0.01)
  for (let iter = 0; iter < 5000; iter++) {
    const diff = rating - weightedAverage(buckets, totalCount)
    if (Math.abs(diff) <= RATING_TOLERANCE) break

    if (diff > 0) {
      // Need a higher average: move mass up one bucket.
      for (let i = 0; i < 4; i++) {
        if (buckets[i] > 0) {
          const move = Math.min(step, buckets[i])
          buckets[i] -= move
          buckets[i + 1] += move
          break
        }
      }
    } else {
      // Need a lower average: move mass down one bucket.
      for (let i = 4; i > 0; i--) {
        if (buckets[i] > 0) {
          const move = Math.min(step, buckets[i])
          buckets[i] -= move
          buckets[i - 1] += move
          break
        }
      }
    }
  }

  // Step 4: round to integers, then reconcile rounding drift by adjusting the
  // dominant (largest) bucket so the histogram sums to exactly totalCount.
  const rounded = buckets.map((c) => Math.round(c))
  const drift = totalCount - rounded.reduce((a, b) => a + b, 0)
  let domIdx = 0
  for (let i = 1; i < 5; i++) if (rounded[i] > rounded[domIdx]) domIdx = i
  rounded[domIdx] += drift

  return [rounded[0], rounded[1], rounded[2], rounded[3], rounded[4]]
}

/**
 * Sanity reference — maintenance aid, not a test dependency.
 *
 * The four examples below sit inside the J-curve's natural average band
 * (~4.61–4.71), so they exercise the scale → round → drift-reconcile path
 * with the mass-shift loop short-circuited. Each is hand-verifiable: output
 * is round(J_CURVE_WEIGHTS × total) with rounding drift folded into the
 * dominant (5-star) bucket, and each sums to exactly `total`.
 *
 *   rating=4.70, total=156  → [2, 3, 7, 22, 122]    sum 156   (spec §6 worked example)
 *   rating=4.66, total=1000 → [13, 20, 45, 140, 782] sum 1000
 *   rating=4.65, total=500  → [7, 10, 23, 70, 390]   sum 500   (drift −1 → 5★ bucket)
 *   rating=4.62, total=88   → [1, 2, 4, 12, 69]      sum 88
 *
 * Ratings outside that band additionally run the adjacent-bucket mass-shift
 * loop before rounding (e.g. rating=3.5 pulls mass down toward 1–3 stars);
 * those outputs are not hand-traceable but obey the same two invariants —
 * sum === total, and |weightedAverage − rating| ≤ 0.05.
 */
