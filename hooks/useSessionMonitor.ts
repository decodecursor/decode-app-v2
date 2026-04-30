'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import activityTracker from '@/utils/activity-tracker';

// 30-day silent idle timeout (creator-dashboard category standard).
// Cookie maxAge in utils/supabase/server.ts is aligned to the same window.
const LOGOUT_TIME = 30 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL = 60 * 1000;

export function useSessionMonitor() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = useCallback(async () => {
    // Route-aware fallback so an idle ambassador lands on /model/auth
    // and legacy users on /auctions, /offers, etc. still hit /auth.
    const target =
      typeof window !== 'undefined' && window.location.pathname.startsWith('/model')
        ? '/model/auth'
        : '/auth';
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during logout:', error);
    }
    router.push(target);
  }, [router, supabase]);

  const checkSessionStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      if (activityTracker.getTimeSinceLastActivity() >= LOGOUT_TIME) {
        await handleLogout();
      }
    } catch (error) {
      console.error('Error checking session status:', error);
    }
  }, [supabase, handleLogout]);

  useEffect(() => {
    activityTracker.init();
    const interval = setInterval(checkSessionStatus, CHECK_INTERVAL);
    checkSessionStatus();
    return () => clearInterval(interval);
  }, [checkSessionStatus]);
}
