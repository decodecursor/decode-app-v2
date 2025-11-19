import { useEffect, useState } from 'react';

/**
 * Hook to detect when the page becomes visible/hidden
 * Critical for mobile devices where WebSocket connections may suspend
 * when users switch apps or the browser goes to background
 */
export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(true);
  const [visibilityChangeCount, setVisibilityChangeCount] = useState(0);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);

      // Increment counter when page becomes visible (returned from background)
      // This triggers effects in components that depend on this value
      if (visible) {
        setVisibilityChangeCount(prev => prev + 1);
      }
    };

    // Initial state
    setIsVisible(!document.hidden);

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { isVisible, visibilityChangeCount };
}
