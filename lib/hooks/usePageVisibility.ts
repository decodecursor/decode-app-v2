import { useEffect, useState } from 'react';

/**
 * Hook to detect when the page becomes visible/hidden
 * Critical for mobile devices where WebSocket connections may suspend
 * when users switch apps or the browser goes to background
 */
export function usePageVisibility() {
  // Lazy initializer: set correct initial state based on document visibility
  // This prevents unnecessary re-renders on mount
  const [isVisible, setIsVisible] = useState(() =>
    typeof document !== 'undefined' ? !document.hidden : true
  );
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

    // Listen for visibility changes (no unconditional setState - initial state is already correct)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { isVisible, visibilityChangeCount };
}
