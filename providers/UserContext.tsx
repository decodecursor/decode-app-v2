'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { UserRole, validateUserProfile } from '@/types/user'
import { getUserWithProxy } from '@/utils/auth-helper'

interface UserProfile {
  user_name: string | null
  role: UserRole | null
  company_name: string | null
  branch_name: string | null
  branches: string[]
  approval_status: string | null
  companyProfileImage: string | null
  pendingUsersCount?: number
}

interface UserContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAuthenticating: boolean
  authCompleted: boolean
  error: string | null
  refreshProfile: () => Promise<void>
}

const UserContext = createContext<UserContextType | null>(null)

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authCompleted, setAuthCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authCheckAttempts, setAuthCheckAttempts] = useState(0)

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to fetch profile:', errorData.error)

        // If no profile exists, return minimal data
        if (response.status === 404 || errorData.error === 'NO_PROFILE') {
          return null
        }
        throw new Error(errorData.error || 'Failed to fetch profile')
      }

      const { userData } = await response.json()

      // Use validateUserProfile like the Users page does - this ensures role is normalized
      const validatedProfile = validateUserProfile(userData)

      // Parse branches
      const branches = userData?.branch_name
        ? userData.branch_name.split(',').map((b: string) => b.trim()).filter((b: string) => b !== '')
        : []

      const profileData: UserProfile = {
        user_name: validatedProfile.user_name,
        role: validatedProfile.role, // This is now properly normalized
        company_name: validatedProfile.company_name || validatedProfile.professional_center_name || null,
        branch_name: branches[0] || null,
        branches,
        approval_status: validatedProfile.approval_status,
        companyProfileImage: validatedProfile.companyProfileImage,
        pendingUsersCount: validatedProfile.pendingUsersCount
      }

      return profileData
    } catch (error) {
      console.error('Error fetching profile:', error)
      throw error
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return

    try {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    } catch (error) {
      console.error('Error refreshing profile:', error)
    }
  }, [user, fetchProfile])

  useEffect(() => {
    const initUser = async () => {
      const authStartTime = Date.now()
      const maxAuthTimeout = 10000 // 10 seconds max for entire auth process

      // Circuit breaker - set a maximum timeout for authentication
      const authTimeoutId = setTimeout(() => {
        console.error('🚨 [UserContext] Authentication timeout after 10 seconds')
        setError('Authentication timed out. Please refresh the page.')
        setIsAuthenticating(false)
        setAuthCompleted(true)
        setLoading(false)
      }, maxAuthTimeout)

      try {
        setError(null)
        setAuthCheckAttempts(prev => prev + 1)
        setIsAuthenticating(true)
        setAuthCompleted(false)

        // Check if we're coming from a fresh login (reduce delays for better UX)
        const isFromLogin = typeof window !== 'undefined' &&
          (document.referrer.includes('/auth') || sessionStorage.getItem('fresh_login') === 'true')

        console.log('🔄 [UserContext] Init user attempt:', {
          authCheckAttempts,
          isFromLogin,
          referrer: typeof window !== 'undefined' ? document.referrer : 'server',
          hasFreshLoginFlag: typeof window !== 'undefined' ? !!sessionStorage.getItem('fresh_login') : false,
          hasFreshLoginProcessedFlag: typeof window !== 'undefined' ? !!sessionStorage.getItem('fresh_login_processed') : false
        })

        // Only add delay on mobile for non-login flows to prevent blinking
        if (typeof window !== 'undefined' && authCheckAttempts === 0 && !isFromLogin) {
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
          if (isMobile) {
            console.log('📱 [UserContext] Mobile device detected, minimal delay for cookie settlement')
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        }

        // Add extra delay for fresh login to ensure session is fully established
        if (isFromLogin && authCheckAttempts === 0) {
          console.log('🔄 [UserContext] Fresh login detected, allowing extra time for session establishment')
          await new Promise(resolve => setTimeout(resolve, 400))
        }

        // Single auth check using proxy-first approach with retry for fresh logins
        let authUser = null
        let authError = null
        let retryCount = 0
        const maxRetries = isFromLogin ? 3 : 1

        while (retryCount < maxRetries) {
          const result = await getUserWithProxy()
          authUser = result.user
          authError = result.error

          if (authUser || !isFromLogin) {
            // Success or not a fresh login - stop retrying
            break
          }

          if (retryCount < maxRetries - 1) {
            console.log(`🔄 [UserContext] Fresh login auth attempt ${retryCount + 1} failed, retrying...`)
            await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)))
          }
          retryCount++
        }

        console.log('🔍 [UserContext] Authentication result:', {
          hasUser: !!authUser,
          hasError: !!authError,
          errorMessage: authError,
          retriesUsed: retryCount,
          isFromLogin,
          userId: authUser?.id?.substring(0, 8) + '...' || 'none'
        })

        if (authError) {
          // Reduce retry logic to prevent blinking - only retry on very specific conditions
          if (authCheckAttempts === 0 && !isFromLogin && typeof window !== 'undefined') {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
            if (isMobile && authError.includes('network')) {
              console.log('🔄 [UserContext] Network error on mobile, single retry...')
              setTimeout(() => initUser(), 800)
              return
            }
          }
          setError(authError)
          setIsAuthenticating(false)
          setAuthCompleted(true)
          setLoading(false)
          return
        }

        if (!authUser) {
          // No user logged in - this is OK, not an error
          setIsAuthenticating(false)
          setAuthCompleted(true)
          setLoading(false)
          return
        }

        setUser(authUser)

        // Only fetch profile if we have a user
        // Use Promise.race to timeout if profile fetch is slow
        const profilePromise = fetchProfile(authUser.id)
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 2000) // Reduced timeout to prevent delays
        )

        try {
          const profileData = await Promise.race([profilePromise, timeoutPromise])
          if (profileData !== null) {
            setProfile(profileData)
          }
        } catch (profileError) {
          console.error('Profile fetch error:', profileError)
          // Don't fail if profile fetch fails - user might need to set up profile
        }

        // Set auth completed AFTER user is set (moved from finally block)
        setIsAuthenticating(false)
        setAuthCompleted(true)
        setLoading(false)
      } catch (error) {
        console.error('Init user error:', error)
        setError('Failed to initialize user')
        setIsAuthenticating(false)
        setAuthCompleted(true)
      } finally {
        // Clear the timeout since auth completed
        clearTimeout(authTimeoutId)

        // Clear fresh login flags after authentication attempt is complete
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('fresh_login')
          sessionStorage.removeItem('fresh_login_processed')
        }

        const authDuration = Date.now() - authStartTime
        console.log(`🔍 [UserContext] Authentication completed in ${authDuration}ms`)
      }
    }

    initUser()
  }, [fetchProfile])

  // Synchronize authCompleted state to prevent race conditions
  // This ensures Dashboard only proceeds when user state is properly set
  useEffect(() => {
    // If we have a user but authCompleted is false, complete the auth
    if (user && !authCompleted && !isAuthenticating) {
      console.log('🔗 [UserContext] Synchronizing auth completion after user state update')
      setAuthCompleted(true)
      setLoading(false)
    }
  }, [user, authCompleted, isAuthenticating])

  return (
    <UserContext.Provider value={{ user, profile, loading, isAuthenticating, authCompleted, error, refreshProfile }}>
      {children}
    </UserContext.Provider>
  )
}