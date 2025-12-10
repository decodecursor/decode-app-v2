import { createClient } from '@/utils/supabase/client'

export interface BackupSession {
  access_token: string
  refresh_token: string
  user: any
  expires_at: number
  stored_at: number
}

/**
 * Ensures authentication session is properly set up for the current user
 * Call this on page load for authenticated pages
 */
export async function ensureAuthSession(): Promise<{ user: any, isFromBackup: boolean } | null> {
  if (typeof window === 'undefined') return null

  try {
    console.log('🔍 Auth Session: Checking authentication...')

    const supabase = createClient()

    // Try to get the current session
    const { data: { session } } = await supabase.auth.getSession()

    if (session && session.user) {
      console.log('✅ Auth Session: Session found')
      return {
        user: session.user,
        isFromBackup: false
      }
    }

    // If no session, try to restore from backup
    const backupSessionStr = localStorage.getItem('supabase_backup_session')
    if (backupSessionStr) {
      try {
        const backupSession: BackupSession = JSON.parse(backupSessionStr)

        // Check if token is still valid
        const tokenExpiresAt = backupSession.expires_at * 1000
        if (tokenExpiresAt > Date.now() + 60000) { // 1 minute buffer
          console.log('📦 Auth Session: Attempting to restore from backup')

          // Try to set the session
          const { data, error } = await supabase.auth.setSession({
            access_token: backupSession.access_token,
            refresh_token: backupSession.refresh_token
          })

          if (!error && data.session) {
            console.log('✅ Auth Session: Restored from backup')
            return {
              user: data.session.user,
              isFromBackup: true
            }
          }
        } else {
          console.log('⏰ Auth Session: Backup token expired')
          localStorage.removeItem('supabase_backup_session')
        }
      } catch (error) {
        console.error('❌ Auth Session: Failed to restore from backup:', error)
        localStorage.removeItem('supabase_backup_session')
      }
    }

    console.log('❌ Auth Session: No valid session found')
    return null

  } catch (error) {
    console.error('❌ Auth Session: Error during session check:', error)
    return null
  }
}

/**
 * Clears all authentication data (both normal and backup)
 */
export function clearAllAuthData(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem('supabase_backup_session')
    localStorage.removeItem('sb-auth-token')

    // Clear cookies as well
    document.cookie.split(";").forEach(function(c) {
      if (c.includes('sb-') || c.includes('supabase')) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      }
    });

    console.log('✅ Auth Restoration: All auth data cleared')
  } catch (error) {
    console.error('❌ Auth Restoration: Error clearing auth data:', error)
  }
}