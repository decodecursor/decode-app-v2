'use client'

import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User, SupabaseClient } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  supabase: SupabaseClient
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Create supabase client once and share it
  const supabase = useMemo(() => createClient(), [])

  const refreshSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
    } catch (error) {
      console.error('Error refreshing session:', error)
      setUser(null)
    }
  }

  const signOut = async () => {
    try {
      // Clear all local storage
      localStorage.removeItem('supabase_backup_session')
      localStorage.removeItem('sb-auth-token')

      // Sign out from Supabase
      await supabase.auth.signOut()
      setUser(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  useEffect(() => {
    // Initial session check
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user || null)
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshSession, supabase }}>
      {children}
    </AuthContext.Provider>
  )
}