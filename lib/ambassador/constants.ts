// ============================================================================
// DECODE Ambassador Feature — Shared Constants
// ============================================================================

/**
 * Reserved slugs — blocked at signup + checked in [slug]/page.tsx
 * Case-insensitive comparison required.
 */
export const RESERVED_SLUGS = [
  'admin', 'login', 'signup', 'api', 'settings', 'dashboard', 'model', 'auth',
  'register', 'pay', 'payment', 'offers', 'auctions', 'profile', 'terms', 'privacy',
  'expired', 'listing', 'wish', 'bank-account', 'debug', 'verify-email',
  'pending-approval', 'my-links', 'www', 'app', 'mail', 'about', 'contact', 'help',
  'support', 'blog', 'press', 'jobs', 'careers', 'faq', 'home', 'welovedecode',
] as const

/**
 * Zero-decimal currencies — Stripe expects whole units (not cents)
 * e.g. JPY 1000 sends as 1000, not 100000
 */
export const ZERO_DECIMAL_CURRENCIES = [
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
] as const

/** Platform fee rate — 20% commission */
export const PLATFORM_FEE_RATE = 0.20

/** Payment link token length */
export const TOKEN_LENGTH = 8

/** Token charset for payment link tokens */
export const TOKEN_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// ============================================================================
// Design Tokens (from PROJECT_STATE Phase 7)
// ============================================================================

export const COLORS = {
  pageBg: '#111',
  frameBg: '#000',
  frameBorder: '#1a1a1a',
  cardBg: '#1c1c1c',
  rowHover: '#262626',
  pink: '#e91e8c',
  green: '#34d399',
  greenToast: '#4ade80',
  bodyText: '#ccc',
  bodyWhite: '#fff',
  secondary888: '#888',
  secondary777: '#777',
  secondary666: '#666',
} as const

// ============================================================================
// Country → Currency mapping (for Vercel x-vercel-ip-country header)
// ============================================================================

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  AE: 'aed', US: 'usd', GB: 'gbp', EU: 'eur', DE: 'eur', FR: 'eur', IT: 'eur',
  ES: 'eur', NL: 'eur', BE: 'eur', AT: 'eur', IE: 'eur', PT: 'eur', FI: 'eur',
  GR: 'eur', SK: 'eur', SI: 'eur', LV: 'eur', LT: 'eur', EE: 'eur', CY: 'eur',
  MT: 'eur', LU: 'eur', HR: 'eur',
  SA: 'sar', KW: 'kwd', BH: 'bhd', OM: 'omr', QA: 'qar',
  IN: 'inr', PK: 'pkr', BD: 'bdt', LK: 'lkr',
  JP: 'jpy', KR: 'krw', CN: 'cny', HK: 'hkd', SG: 'sgd', MY: 'myr', TH: 'thb',
  ID: 'idr', PH: 'php', VN: 'vnd', TW: 'twd',
  AU: 'aud', NZ: 'nzd',
  CA: 'cad', MX: 'mxn', BR: 'brl', AR: 'ars', CO: 'cop', CL: 'clp',
  ZA: 'zar', NG: 'ngn', KE: 'kes', EG: 'egp', MA: 'mad',
  TR: 'try', RU: 'rub', UA: 'uah', PL: 'pln', CZ: 'czk', HU: 'huf',
  RO: 'ron', SE: 'sek', NO: 'nok', DK: 'dkk', CH: 'chf', IL: 'ils',
  JO: 'jod', LB: 'lbp',
}

/**
 * Map ISO 3166-1 alpha-2 country code to lowercase ISO 4217 currency.
 * Fallback: 'aed' (UAE-first business).
 */
export function countryToCurrency(countryCode: string): string {
  return COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()] || 'aed'
}
