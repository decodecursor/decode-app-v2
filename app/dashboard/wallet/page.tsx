'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { WalletDashboard } from '@/components/dashboard/WalletDashboard'
import Link from 'next/link'

export default function WalletPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUser(user)
      setLoading(false)
    }
    
    getUser()
  }, [])

  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen px-4 py-8">
        {/* Navigation */}
        <div className="mx-auto mb-8" style={{maxWidth: '3000px'}}>
          <div className="cosmic-card p-4">
            <div className="flex items-center justify-between">
              <Link 
                href="/dashboard" 
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back to Dashboard</span>
              </Link>
              
              <h1 className="text-xl font-bold text-white">Crypto Wallet</h1>
              
              <div className="w-24"></div> {/* Spacer for centering */}
            </div>
          </div>
        </div>

        {/* Wallet Dashboard */}
        <div className="mx-auto" style={{maxWidth: '3000px'}}>
          <WalletDashboard user={user} />
        </div>
      </div>
    </div>
  )
}