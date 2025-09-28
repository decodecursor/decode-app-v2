'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import activityTracker from '@/utils/activity-tracker';

// Session timeout durations
const WARNING_TIME = 12 * 60 * 60 * 1000 + 50 * 60 * 1000; // 12 hours 50 minutes
const LOGOUT_TIME = 13 * 60 * 60 * 1000; // 13 hours
const CHECK_INTERVAL = 60 * 1000; // Check every minute

export function useSessionMonitor() {
  const [showWarning, setShowWarning] = useState(false);
  const [lastActivityFormatted, setLastActivityFormatted] = useState('');
  const router = useRouter();
  const supabase = createClient();

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      console.log('🚪 Logging out due to inactivity...');
      await supabase.auth.signOut();
      router.push('/auth');
    } catch (error) {
      console.error('Error during logout:', error);
      // Force redirect even if signout fails
      router.push('/auth');
    }
  }, [router, supabase]);

  // Handle continue session
  const handleContinueSession = useCallback(() => {
    console.log('✅ User chose to continue session');
    activityTracker.reset();
    setShowWarning(false);
  }, []);

  // Check session status
  const checkSessionStatus = useCallback(async () => {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No active session, nothing to monitor
        return;
      }

      const inactivityTime = activityTracker.getTimeSinceLastActivity();

      // Update formatted time for display
      setLastActivityFormatted(activityTracker.getFormattedInactivityTime());

      // Check if we should logout
      if (inactivityTime >= LOGOUT_TIME) {
        console.log('⏰ Session timeout reached - logging out');
        await handleLogout();
      }
      // Check if we should show warning
      else if (inactivityTime >= WARNING_TIME && !showWarning) {
        console.log('⚠️ Showing session timeout warning');
        setShowWarning(true);
      }
      // Hide warning if user became active again
      else if (inactivityTime < WARNING_TIME && showWarning) {
        setShowWarning(false);
      }
    } catch (error) {
      console.error('Error checking session status:', error);
    }
  }, [supabase, handleLogout, showWarning]);

  // Initialize activity tracking and session monitoring
  useEffect(() => {
    // Initialize activity tracker
    activityTracker.init();

    // Set up periodic session checks
    const interval = setInterval(checkSessionStatus, CHECK_INTERVAL);

    // Initial check
    checkSessionStatus();

    // Listen for activity updates
    const handleActivityUpdate = () => {
      // If warning is showing and user becomes active, hide it
      if (showWarning && activityTracker.getTimeSinceLastActivity() < WARNING_TIME) {
        setShowWarning(false);
      }
    };

    activityTracker.addListener(handleActivityUpdate);

    // Cleanup
    return () => {
      clearInterval(interval);
      activityTracker.removeListener(handleActivityUpdate);
    };
  }, [checkSessionStatus, showWarning]);

  return {
    showWarning,
    lastActivityFormatted,
    handleContinueSession,
    handleLogout
  };
}