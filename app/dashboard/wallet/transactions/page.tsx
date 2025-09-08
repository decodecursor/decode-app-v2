'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'
import { TransactionHistory } from '@/components/dashboard/TransactionHistory'
import Link from 'next/link'

export default function TransactionsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)

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

  // Loading state removed - show content immediately

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
                href="/dashboard/wallet" 
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back to Wallet</span>
              </Link>
              
              <h1 className="text-xl font-bold text-white">Transaction History</h1>
              
              <div className="w-32"></div> {/* Spacer for centering */}
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="mx-auto" style={{maxWidth: '3000px'}}>
          <TransactionHistory user={user} />
        </div>
      </div>
    </div>
  )
}