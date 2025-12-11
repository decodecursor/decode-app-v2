/**
 * useAuctionCardsData Hook
 * Coordinates loading of supplementary data (videos and business info) for all auction cards
 * Ensures all data is loaded before rendering to prevent progressive loading flicker
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Auction } from '@/lib/models/Auction.model';

/**
 * Video data structure returned from /api/auctions/${id}/video/view
 */
export interface VideoData {
  id: string;
  file_url: string | null;
  token_expires_at: string | null;
  watched_to_end_at: string | null;
  payout_unlocked_at: string | null;
}

/**
 * Business data structure returned from /api/beauty-businesses/${id}
 */
export interface BusinessData {
  id: string;
  business_name: string;
  instagram_handle: string | null;
  city: string | null;
  business_photo_url: string | null;
}

/**
 * Enriched auction with pre-loaded video and business data
 */
export interface EnrichedAuction extends Auction {
  videoData: VideoData | null;
  businessData: BusinessData | null;
}

/**
 * Hook to coordinate loading of all auction card data
 * Fetches video metadata and business info for all auctions in parallel
 *
 * @param auctions - Array of auctions from useActiveAuctions()
 * @returns Enriched auctions with video and business data, loading state, and error
 */
export function useAuctionCardsData(auctions: Auction[]) {
  const [enrichedAuctions, setEnrichedAuctions] = useState<EnrichedAuction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCardData = useCallback(async () => {
    // Empty auctions array - immediate return
    if (auctions.length === 0) {
      setEnrichedAuctions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create array of fetch promises for each auction
      const fetchPromises = auctions.map(async (auction) => {
        // Fetch video data
        const videoPromise = fetch(`/api/auctions/${auction.id}/video/view`)
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              return data.video as VideoData | null;
            }
            // 401/403/404 are expected for auctions without videos or non-creators
            if (res.status === 401 || res.status === 403 || res.status === 404) {
              return null;
            }
            // Log other errors but don't fail
            console.warn(`Failed to fetch video for auction ${auction.id}:`, res.status);
            return null;
          })
          .catch((err) => {
            console.warn(`Error fetching video for auction ${auction.id}:`, err);
            return null;
          });

        // Fetch business data if linked
        const businessPromise = auction.linked_business_id
          ? fetch(`/api/beauty-businesses/${auction.linked_business_id}`)
              .then(async (res) => {
                if (res.ok) {
                  const data = await res.json();
                  return data.business as BusinessData | null;
                }
                // 404 is expected if business was deleted
                if (res.status === 404) {
                  return null;
                }
                // Log other errors but don't fail
                console.warn(`Failed to fetch business ${auction.linked_business_id}:`, res.status);
                return null;
              })
              .catch((err) => {
                console.warn(`Error fetching business ${auction.linked_business_id}:`, err);
                return null;
              })
          : Promise.resolve(null);

        // Wait for both fetches to complete
        const [videoData, businessData] = await Promise.all([
          videoPromise,
          businessPromise
        ]);

        // Return enriched auction
        return {
          ...auction,
          videoData,
          businessData,
        } as EnrichedAuction;
      });

      // Wait for all auctions to be enriched
      // Use Promise.allSettled to handle individual failures gracefully
      const results = await Promise.allSettled(fetchPromises);

      // Extract fulfilled results
      const enriched = results
        .filter((result): result is PromiseFulfilledResult<EnrichedAuction> =>
          result.status === 'fulfilled'
        )
        .map(result => result.value);

      // Log any rejected promises
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to enrich auction ${auctions[index].id}:`, result.reason);
        }
      });

      setEnrichedAuctions(enriched);
      setIsLoading(false);

    } catch (err) {
      console.error('Error loading auction card data:', err);
      setError(err instanceof Error ? err : new Error('Failed to load auction data'));
      setIsLoading(false);
    }
  }, [auctions]);

  // Fetch data when auctions array changes
  useEffect(() => {
    fetchCardData();
  }, [fetchCardData]);

  return {
    enrichedAuctions,
    isLoading,
    error,
  };
}
