import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ============================================================================
// Upstash Redis client — serverless-safe rate limiting
// Requires env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// ============================================================================

const redis = Redis.fromEnv()

/**
 * Wish checkout: 3 attempts per IP per 10 minutes.
 * Prevents wish-locking griefing.
 */
export const checkoutLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '10 m'),
  prefix: 'rl:checkout',
})

/**
 * WhatsApp OTP send: 3 per phone per hour.
 */
export const authPhoneLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'rl:auth:phone',
})

/**
 * Auth sends: 10 per IP per hour (covers both OTP and magic link).
 */
export const authIpLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'rl:auth:ip',
})

/**
 * Magic link send: 3 per email per hour.
 */
export const authEmailLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'rl:auth:email',
})

/**
 * Analytics event dedup: 1 per IP per event_type per 30 seconds.
 * Key format: rl:analytics:{ip}:{event_type}
 */
export const analyticsLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, '30 s'),
  prefix: 'rl:analytics',
})

/**
 * Listing creation: 20 per user per hour.
 */
export const listingCreateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'rl:listing:create',
})
