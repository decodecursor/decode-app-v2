'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { VerificationBadge } from '@/components/stripe/VerificationBadge'
import type { User } from '@supabase/supabase-js'

export default function BankAccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [accountStatus, setAccountStatus] = useState<'not_connected' | 'pending' | 'active' | 'restricted'>('not_connected')
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null)
  const [balance, setBalance] = useState<{ available: number; pending: number; currency: string }>({ 
    available: 0, 
    pending: 0, 
    currency: 'AED' 
  })
  const [nextPayoutDate, setNextPayoutDate] = useState<string | null>(null)
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    // Handle return from Stripe onboarding
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('success') === 'true') {
      setMessage({ type: 'success', text: 'Onboarding completed successfully! Loading your account details...' })
      if (user) {
        loadAccountData(user.id)
      }
    } else if (urlParams.get('refresh') === 'true') {
      setMessage({ type: 'info', text: 'Onboarding session expired. Please try again.' })
    }
  }, [user])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      setUser(user)
      await loadAccountData(user.id)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/auth')
    }
  }

  const loadAccountData = async (userId: string) => {
    try {
      setLoading(true)
      
      // Fetch user data including Stripe Connect info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, stripe_connect_account_id, stripe_connect_status, stripe_onboarding_completed')
        .eq('id', userId)
        .single()

      if (userError) {
        console.error('Database error:', userError.message)
        setMessage({ type: 'error', text: `Database error: ${userError.message}` })
        setLoading(false)
        return
      }

      if (userData) {
        setUserRole(userData.role)
        
        if (userData.stripe_connect_account_id) {
          setStripeAccountId(userData.stripe_connect_account_id)
          setAccountStatus((userData.stripe_connect_status as 'not_connected' | 'pending' | 'active' | 'restricted') || 'pending')

          // Load balance if account is active
          if (userData.stripe_connect_status === 'active') {
            try {
              const balanceResponse = await fetch(`/api/stripe/account-balance?userId=${userId}`)
              if (balanceResponse.ok) {
                const balanceData = await balanceResponse.json()
                setBalance({
                  available: balanceData.available || 0,
                  pending: balanceData.pending || 0,
                  currency: balanceData.currency || 'AED'
                })
              }
            } catch (error) {
              console.error('Error loading balance:', error)
            }

            // Calculate next Monday for payout date
            const today = new Date()
            const daysUntilMonday = (8 - today.getDay()) % 7 || 7
            const nextMonday = new Date(today)
            nextMonday.setDate(today.getDate() + daysUntilMonday)
            setNextPayoutDate(nextMonday.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }))
          }
        }
      }
    } catch (error) {
      console.error('Error loading account data:', error)
      setMessage({ type: 'error', text: 'Failed to load account information' })
    } finally {
      setLoading(false)
    }
  }

  const createStripeAccount = async () => {
    try {
      setLoading(true)
      setMessage({ type: 'info', text: 'Creating your Stripe Connect account...' })
      
      const response = await fetch('/api/stripe/connect-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error)
      }

      setStripeAccountId(result.accountId)
      setMessage({ type: 'success', text: 'Account created! Starting onboarding process...' })
      
      // Start onboarding
      await startOnboarding(result.accountId)
    } catch (error) {
      console.error('Error creating Stripe account:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create account' })
    } finally {
      setLoading(false)
    }
  }

  const startOnboarding = async (accountId?: string) => {
    try {
      const idToUse = accountId || stripeAccountId
      if (!idToUse) {
        throw new Error('No Stripe account ID available')
      }

      setLoading(true)
      setMessage({ type: 'info', text: 'Preparing onboarding...' })

      const response = await fetch('/api/stripe/account-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: idToUse })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error)
      }

      // Redirect to Stripe onboarding
      window.location.href = result.url
    } catch (error) {
      console.error('Error starting onboarding:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to start onboarding' })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-300">Loading bank account information...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg min-h-screen">
      <div className="container mx-auto px-4 py-8">

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-600/20 text-green-100 border border-green-500/30' : 
            message.type === 'error' ? 'bg-red-600/20 text-red-100 border border-red-500/30' :
            'bg-blue-600/20 text-blue-100 border border-blue-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-6 flex justify-center">
          <div className="max-w-md w-full">
            {/* Back to Dashboard Link */}
            <div className="mb-6">
              <Link
                href="/dashboard"
                className="flex items-center text-gray-300 hover:text-white transition-colors w-fit"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
            
            {/* Not Connected State */}
            {accountStatus === 'not_connected' && (
              <div className="cosmic-card text-center py-12">
                <h2 className="text-2xl font-bold text-white mb-8">
                  {userRole === 'User' ? 'Connect Your Personal Bank Account' : 'Connect Business Bank Account'}
                </h2>
                
                <div className="w-24 h-24 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-8">
                  <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                
                <p className="text-gray-400 mb-8">
                  Connect your bank account to receive weekly payouts from DECODE payments
                </p>
                
                <button
                  onClick={createStripeAccount}
                  disabled={loading}
                  className="cosmic-button-primary disabled:opacity-50 w-full"
                >
                  {loading ? 'Setting up...' : 'Connect Bank Account'}
                </button>
              </div>
            )}

            {/* Pending State */}
            {accountStatus === 'pending' && (
              <div className="cosmic-card text-center py-12">
                <h2 className="text-2xl font-bold text-white mb-8">Bank Account Verification</h2>
                
                <div className="w-24 h-24 bg-yellow-600/20 rounded-full flex items-center justify-center mx-auto mb-8">
                  <svg className="w-12 h-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                <div className="mb-8">
                  <VerificationBadge status="pending" size="lg" />
                </div>
                
                <p className="text-gray-400 mb-8">
                  Your bank account information is being verified. This usually takes 1-2 business days.
                </p>
                
                <button
                  onClick={() => startOnboarding()}
                  disabled={loading}
                  className="cosmic-button-primary disabled:opacity-50 w-full"
                >
                  {loading ? 'Loading...' : 'Complete Verification'}
                </button>
              </div>
            )}

            {/* Restricted State */}
            {accountStatus === 'restricted' && (
              <div className="cosmic-card text-center py-12">
                <h2 className="text-2xl font-bold text-white mb-8">Action Required</h2>
                
                <div className="w-24 h-24 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-8">
                  <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                
                <div className="mb-8">
                  <VerificationBadge status="restricted" size="lg" />
                </div>
                
                <p className="text-gray-400 mb-8">
                  Additional information is required to complete your bank account setup.
                </p>
                
                <button
                  onClick={() => startOnboarding()}
                  disabled={loading}
                  className="cosmic-button-primary disabled:opacity-50 w-full"
                >
                  {loading ? 'Loading...' : 'Complete Setup'}
                </button>
              </div>
            )}

            {/* Active State */}
            {accountStatus === 'active' && (
              <div className="cosmic-card py-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white mb-4">Bank Account Connected</h2>
                  
                  <div className="w-24 h-24 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  
                  <div className="mb-6">
                    <VerificationBadge status="active" size="lg" />
                  </div>
                </div>

                {/* Balance Information */}
                <div className="space-y-6">
                  <div className="bg-gray-800/50 rounded-lg p-6">
                    <div className="text-center">
                      <p className="text-gray-400 text-sm mb-2">Available Balance</p>
                      <p className="text-3xl font-bold text-white">
                        {balance.currency} {balance.available.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {balance.pending > 0 && (
                    <div className="bg-gray-800/50 rounded-lg p-6">
                      <div className="text-center">
                        <p className="text-gray-400 text-sm mb-2">Pending Balance</p>
                        <p className="text-xl font-semibold text-yellow-400">
                          {balance.currency} {balance.pending.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}

                  {nextPayoutDate && (
                    <div className="bg-gray-800/50 rounded-lg p-6">
                      <div className="text-center">
                        <p className="text-gray-400 text-sm mb-2">Next Automatic Payout</p>
                        <p className="text-white font-medium">{nextPayoutDate}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Link
                      href="/dashboard/payouts"
                      className="flex-1 text-center cosmic-button-secondary"
                    >
                      View Payouts
                    </Link>
                    <button
                      onClick={() => startOnboarding()}
                      disabled={loading}
                      className="flex-1 cosmic-button-primary disabled:opacity-50"
                    >
                      Manage Account
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}