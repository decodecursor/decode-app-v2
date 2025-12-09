/**
 * In-Memory Cache for Guest Bidder Records
 *
 * Reduces database queries by caching guest bidder information for 5 minutes.
 * Works for both single and multi-instance deployments (each instance maintains its own cache).
 *
 * Performance Impact:
 * - Cache hit: ~0ms (no DB query)
 * - Cache miss: ~50-100ms (DB query required)
 * - Expected cache hit rate: 70%+ for repeat bidders
 */

interface CachedGuestBidder {
  id: string;
  email: string;
  name: string;
  stripe_customer_id: string | null;
  default_payment_method_id: string | null;
  last_payment_method_saved_at: string | null;
  cached_at: number;
}

class GuestBidderCache {
  private cache: Map<string, CachedGuestBidder> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  /**
   * Get cached guest bidder by email
   * Returns null if not cached or TTL expired
   */
  get(email: string): Omit<CachedGuestBidder, 'cached_at'> | null {
    const normalizedEmail = email.toLowerCase().trim();
    const cached = this.cache.get(normalizedEmail);

    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    const now = Date.now();
    const age = now - cached.cached_at;

    if (age > this.TTL) {
      console.log('[GuestBidderCache] Cache expired for:', normalizedEmail, { age_ms: age, ttl_ms: this.TTL });
      this.cache.delete(normalizedEmail);
      return null;
    }

    console.log('[GuestBidderCache] Cache HIT for:', normalizedEmail, { age_ms: age });

    // Return without cached_at (internal timestamp)
    const { cached_at, ...bidder } = cached;
    return bidder;
  }

  /**
   * Store guest bidder in cache
   */
  set(email: string, bidder: Omit<CachedGuestBidder, 'cached_at'>): void {
    const normalizedEmail = email.toLowerCase().trim();

    this.cache.set(normalizedEmail, {
      ...bidder,
      cached_at: Date.now(),
    });

    console.log('[GuestBidderCache] Cached:', normalizedEmail, {
      guest_bidder_id: bidder.id,
      has_stripe_customer: !!bidder.stripe_customer_id,
      has_payment_method: !!bidder.default_payment_method_id,
    });
  }

  /**
   * Invalidate cache entry for a specific email
   * Use when guest bidder data is updated (e.g., saved new payment method)
   */
  invalidate(email: string): void {
    const normalizedEmail = email.toLowerCase().trim();
    const deleted = this.cache.delete(normalizedEmail);

    if (deleted) {
      console.log('[GuestBidderCache] Invalidated:', normalizedEmail);
    }
  }

  /**
   * Clear entire cache (useful for testing or memory management)
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log('[GuestBidderCache] Cleared entire cache:', { entries_cleared: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; emails: string[] } {
    return {
      size: this.cache.size,
      emails: Array.from(this.cache.keys()),
    };
  }

  /**
   * Remove expired entries (automatic cleanup)
   * Run periodically to prevent unbounded memory growth
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [email, cached] of this.cache.entries()) {
      if (now - cached.cached_at > this.TTL) {
        this.cache.delete(email);
        removed++;
      }
    }

    if (removed > 0) {
      console.log('[GuestBidderCache] Cleanup removed expired entries:', removed);
    }
  }

  constructor() {
    // Run cleanup every 5 minutes to remove expired entries
    if (typeof window === 'undefined') {
      // Server-side only (not in browser)
      setInterval(() => this.cleanup(), this.TTL);
    }
  }
}

// Export singleton instance
export const guestBidderCache = new GuestBidderCache();
