/**
 * useCardReady Hook
 * Ensures a card is fully ready (images loaded + browser painted) before signaling ready
 * Used to keep loading spinners visible until all content is actually rendered
 */

'use client';

import { useState, useEffect, useRef } from 'react';

interface UseCardReadyOptions {
  /** Maximum time to wait for images (default: 5000ms) */
  timeout?: number;
}

/**
 * Hook to determine when a card component is fully ready to display
 *
 * @param imageUrls - Array of image URLs to preload (null/undefined values are filtered)
 * @param options - Configuration options
 * @returns { isReady: boolean } - True when all images are loaded and paint is complete
 */
export function useCardReady(
  imageUrls: (string | null | undefined)[],
  options: UseCardReadyOptions = {}
) {
  const { timeout = 5000 } = options;
  const [isReady, setIsReady] = useState(false);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;

    const markReady = () => {
      if (!isCancelled) {
        // Wait for two animation frames to ensure browser has painted
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!isCancelled) {
              setIsReady(true);
            }
          });
        });
      }
    };

    // Filter out null/undefined/empty URLs
    const validUrls = imageUrls.filter((url): url is string =>
      typeof url === 'string' && url.trim() !== ''
    );

    // If no images to load, wait for paint cycle only
    if (validUrls.length === 0) {
      markReady();
      return;
    }

    // Create promise for each image
    const imagePromises = validUrls.map((url) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Resolve on error too (don't block)
        img.src = url;
      });
    });

    // Timeout fallback
    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn('[useCardReady] Timeout reached after', timeout, 'ms - proceeding anyway');
        resolve();
      }, timeout);
    });

    // Wait for all images OR timeout, then mark ready
    Promise.race([
      Promise.all(imagePromises),
      timeoutPromise
    ]).then(() => {
      clearTimeout(timeoutId);
      markReady();
    });

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, []); // Empty deps - only run once on mount

  return { isReady };
}
