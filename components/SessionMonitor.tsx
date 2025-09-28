'use client';

import { useSessionMonitor } from '@/hooks/useSessionMonitor';
import SessionTimeoutModal from './SessionTimeoutModal';

export default function SessionMonitor() {
  const {
    showWarning,
    lastActivityFormatted,
    handleContinueSession,
    handleLogout
  } = useSessionMonitor();

  return (
    <SessionTimeoutModal
      isOpen={showWarning}
      onContinue={handleContinueSession}
      onLogout={handleLogout}
      lastActivityTime={lastActivityFormatted}
    />
  );
}