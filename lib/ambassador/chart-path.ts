/**
 * SVG path string builder for the Analytics earnings sparkline.
 *
 * Per Slice 6 locked decision #7 (raw SVG, no charting library) the
 * Analytics page renders the sparkline as two static <path d="…"/>
 * elements: one stroked line + one gradient-filled area beneath it.
 * This module computes the `d=` strings server-side from a numeric
 * series so the client just renders strings verbatim (no Math, no
 * client-side chart math, matches `analytics_final.html` mockup
 * exactly — viewBox 280×48).
 *
 * The mockup's anchor points are 40px apart for 8 buckets. We
 * generalize: anchor x = i * (width / (n-1)) for n buckets, anchor
 * y = bottom - (value / max) * (bottom - top).
 *
 * Empty / all-zero series return null — the page hides the chart
 * surface in that case rather than rendering a flat baseline that
 * looks like a bug.
 */

const VIEWBOX_WIDTH = 280
const TOP_PADDING = 8     // matches mockup max-y
const BOTTOM_BASELINE = 48 // matches mockup floor (also viewBox height)

export interface ChartPaths {
  line: string  // stroked path top edge
  fill: string  // closed area path for gradient fill
}

export function buildChartPaths(series: readonly number[]): ChartPaths | null {
  if (series.length < 2) return null
  const max = Math.max(...series)
  if (max <= 0) return null

  const n = series.length
  const xStep = VIEWBOX_WIDTH / (n - 1)
  const yRange = BOTTOM_BASELINE - TOP_PADDING

  const points: string[] = []
  for (let i = 0; i < n; i++) {
    const x = Math.round(i * xStep * 100) / 100
    const y = Math.round((BOTTOM_BASELINE - (series[i] / max) * yRange) * 100) / 100
    points.push(`${x},${y}`)
  }

  const line = `M${points.join(' L')}`
  // Close back to baseline at the right edge then return to baseline at
  // the left edge so the gradient fill paints the area beneath the line.
  const lastX = points[points.length - 1].split(',')[0]
  const fill = `${line} L${lastX},${BOTTOM_BASELINE} L0,${BOTTOM_BASELINE} Z`

  return { line, fill }
}
