import { createClient } from '@/utils/supabase/client'

export interface BackupSession {
  access_token: string
  refresh_token: string
  user: any
  expires_at: number
  stored_at: number
}

/**
 * Restores authentication session from backup tokens if available
 * This is used when direct Supabase auth fails due to network issues
 */
export async function restoreAuthFromBackup(): Promise<{ user: any, session: any } | null> {
  if (typeof window === 'undefined') return null

  try {
    // First try to get the current session normally
    const supabase = createClient()
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session && session.user) {
        console.log('✅ Auth Restoration: Direct session available')
        return { user: session.user, session }
      }
    } catch (directError) {
      console.log('⚠️ Auth Restoration: Direct session failed, checking backup...')
    }

    // Check for backup session tokens
    const backupSessionStr = localStorage.getItem('supabase_backup_session')
    if (!backupSessionStr) {
      console.log('ℹ️ Auth Restoration: No backup session found')
      return null
    }

    const backupSession: BackupSession = JSON.parse(backupSessionStr)
    
    // Check if backup session is still valid (not older than 24 hours)
    const ageHours = (Date.now() - backupSession.stored_at) / (1000 * 60 * 60)
    if (ageHours > 24) {
      console.log('⚠️ Auth Restoration: Backup session expired, clearing it')
      localStorage.removeItem('supabase_backup_session')
      localStorage.removeItem('sb-auth-token')
      return null
    }

    // Check if the token itself is expired
    const tokenExpiresAt = backupSession.expires_at * 1000 // Convert to milliseconds
    if (tokenExpiresAt <= Date.now()) {
      console.log('⚠️ Auth Restoration: Token expired, clearing backup session')
      localStorage.removeItem('supabase_backup_session')
      localStorage.removeItem('sb-auth-token')
      return null
    }

    console.log('✅ Auth Restoration: Using valid backup session')
    
    // Try to restore the session to Supabase client
    try {
      await supabase.auth.setSession({
        access_token: backupSession.access_token,
        refresh_token: backupSession.refresh_token
      })
      console.log('✅ Auth Restoration: Session restored to Supabase client')
    } catch (restoreError) {
      console.log('⚠️ Auth Restoration: Could not restore to client, but backup data available:', restoreError)
    }

    // Return the backup session data
    return {
      user: backupSession.user,
      session: {
        access_token: backupSession.access_token,
        refresh_token: backupSession.refresh_token,
        expires_at: backupSession.expires_at,
        token_type: 'bearer',
        user: backupSession.user
      }
    }

  } catch (error) {
    console.error('❌ Auth Restoration: Error during restoration:', error)
    return null
  }
}

/**
 * Ensures authentication session is properly set up for the current user
 * Call this on page load for authenticated pages
 */
export async function ensureAuthSession(): Promise<{ user: any, isFromBackup: boolean } | null> {
  const restored = await restoreAuthFromBackup()
  
  if (restored) {
    return {
      user: restored.user,
      isFromBackup: !!localStorage.getItem('supabase_backup_session')
    }
  }
  
  return null
}

/**
 * Clears all authentication data (both normal and backup)
 */
export function clearAllAuthData(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem('supabase_backup_session')
    localStorage.removeItem('sb-auth-token')
    console.log('✅ Auth Restoration: All auth data cleared')
  } catch (error) {
    console.error('❌ Auth Restoration: Error clearing auth data:', error)
  }
}