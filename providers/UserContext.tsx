'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { UserRole } from '@/types/user'
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
  const [error, setError] = useState<string | null>(null)

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

      // Parse branches
      const branches = userData?.branch_name
        ? userData.branch_name.split(',').map((b: string) => b.trim()).filter((b: string) => b !== '')
        : []

      const profileData: UserProfile = {
        user_name: userData?.user_name || null,
        role: userData?.role || null,
        company_name: userData?.company_name || userData?.professional_center_name || null,
        branch_name: branches[0] || null,
        branches,
        approval_status: userData?.approval_status || null,
        companyProfileImage: userData?.companyProfileImage || null,
        pendingUsersCount: userData?.pendingUsersCount
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
      try {
        setError(null)
        const { user: authUser, error: authError } = await getUserWithProxy()

        if (authError) {
          setError(authError)
          setLoading(false)
          return
        }

        if (!authUser) {
          setLoading(false)
          return
        }

        setUser(authUser)

        // Fetch profile data
        try {
          const profileData = await fetchProfile(authUser.id)
          setProfile(profileData)
        } catch (profileError) {
          console.error('Profile fetch error:', profileError)
          // Don't fail if profile fetch fails - user might need to set up profile
        }
      } catch (error) {
        console.error('Init user error:', error)
        setError('Failed to initialize user')
      } finally {
        setLoading(false)
      }
    }

    initUser()
  }, [fetchProfile])

  return (
    <UserContext.Provider value={{ user, profile, loading, error, refreshProfile }}>
      {children}
    </UserContext.Provider>
  )
}