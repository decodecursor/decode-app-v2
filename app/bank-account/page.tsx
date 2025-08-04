'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ConnectAccountManagement } from '@/components/stripe/ConnectAccountManagement'
import { ConnectNotificationBanner } from '@/components/stripe/ConnectNotificationBanner'
import { VerificationBadge } from '@/components/stripe/VerificationBadge'
import { BankAccountCard } from '@/components/stripe/BankAccountCard'
import { AccountStatusOverview } from '@/components/stripe/AccountStatusOverview'
import { ConnectComponentWrapper } from '@/components/stripe/ConnectComponentWrapper'
import { PayoutHistory } from '@/components/stripe/PayoutHistory'

export default function BankAccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [accountStatus, setAccountStatus] = useState<'not_connected' | 'pending' | 'active' | 'restricted'>('not_connected')
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [currentStep, setCurrentStep] = useState<'loading' | 'create' | 'onboarding' | 'complete'>('loading')
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null)
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [balance, setBalance] = useState<{ available: number; pending: number; currency: string }>({ 
    available: 0, 
    pending: 0, 
    currency: 'AED' 
  })
  const [nextPayoutDate, setNextPayoutDate] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ show: boolean; action: 'remove' | 'setPrimary' | null; accountId: string | null }>({ show: false, action: null, accountId: null })
  const [actionLoading, setActionLoading] = useState(false)
  
  // Form fields for simplified bank account entry
  const [beneficiary, setBeneficiary] = useState('')
  const [iban, setIban] = useState('')
  const [bank, setBank] = useState('')
  const [isConnected, setIsConnected] = useState(false)

  const handleSaveBankAccount = async () => {
    if (!beneficiary.trim() || !iban.trim() || !bank.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    setLoading(true)
    setMessage({ type: 'info', text: 'Saving bank account details...' })
    
    // Simulate saving process
    setTimeout(() => {
      setIsConnected(true)
      setMessage(null)
      setLoading(false)
    }, 1000)
  }

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    // Handle return from Stripe onboarding
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('success') === 'true') {
      setMessage({ type: 'success', text: 'Onboarding completed successfully! Loading your account details...' })
      setCurrentStep('complete')
      if (user) {
        loadAccountData(user.id)
      }
    } else if (urlParams.get('refresh') === 'true') {
      setMessage({ type: 'info', text: 'Onboarding session expired. Please try again.' })
      setCurrentStep('onboarding')
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
      // Simple approach: just verify user exists and show info message
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single()

      if (userError) {
        console.error('🔴 Database error:', userError.message)
        setMessage({ type: 'error', text: `Database error: ${userError.message}` })
        setLoading(false)
        return
      }

      if (userData) {
        // User exists, show normal interface
        setCurrentStep('create')
        setLoading(false)
        return
      }
    } catch (error) {
      console.error('Error loading account data:', error)
      setMessage({ type: 'error', text: 'Failed to load account information' })
      setLoading(false)
    }
  }

  const loadBankAccountDetails = async (userId: string) => {
    try {
      // Load bank accounts
      const { data: accounts } = await supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })

      if (accounts) {
        setBankAccounts(accounts)
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

      // Load actual balance from Stripe
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
    } catch (error) {
      console.error('Error loading bank account details:', error)
    }
  }

  const createStripeAccount = async () => {
    try {
      setMessage({ type: 'info', text: 'Creating your Stripe Connect account...' })
      
      const response = await fetch('/api/stripe/connect-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error)
      }

      setStripeAccountId(result.accountId)
      setCurrentStep('onboarding')
      setMessage({ type: 'success', text: 'Account created! Please complete the onboarding process.' })
    } catch (error) {
      console.error('Error creating Stripe account:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create account' })
    }
  }

  const handleOnboardingComplete = async () => {
    setOnboardingComplete(true)
    setCurrentStep('complete')
    setMessage({ type: 'success', text: 'Bank account setup completed successfully!' })
    
    // Reload account data to get updated status
    if (user) {
      await loadAccountData(user.id)
    }
  }

  const handleOnboardingExit = () => {
    setMessage({ type: 'info', text: 'You can complete the onboarding process anytime.' })
  }

  const handleSetPrimary = async (accountId: string) => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/stripe/bank-account/set-primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, userId: user?.id })
      })

      if (!response.ok) {
        throw new Error('Failed to set primary account')
      }

      setMessage({ type: 'success', text: 'Primary bank account updated successfully' })
      await loadBankAccountDetails(user.id)
    } catch (error) {
      console.error('Error setting primary account:', error)
      setMessage({ type: 'error', text: 'Failed to update primary account' })
    } finally {
      setActionLoading(false)
      setShowConfirmDialog({ show: false, action: null, accountId: null })
    }
  }

  const handleRemoveAccount = async (accountId: string) => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/stripe/bank-account/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, userId: user?.id })
      })

      if (!response.ok) {
        throw new Error('Failed to remove bank account')
      }

      setMessage({ type: 'success', text: 'Bank account removed successfully' })
      await loadBankAccountDetails(user.id)
    } catch (error) {
      console.error('Error removing account:', error)
      setMessage({ type: 'error', text: 'Failed to remove bank account' })
    } finally {
      setActionLoading(false)
      setShowConfirmDialog({ show: false, action: null, accountId: null })
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

        {/* Notification Banner */}
        {stripeAccountId && accountStatus === 'restricted' && (
          <ConnectNotificationBanner accountId={stripeAccountId} />
        )}


        {/* Main Content */}
        <div className="space-y-6 flex justify-center">
          {currentStep === 'create' && (
            <div className="cosmic-card text-center py-12 max-w-md w-full relative">
              {/* Back to Dashboard Link */}
              <Link
                href="/dashboard"
                className="absolute top-4 left-4 flex items-center text-gray-300 hover:text-white transition-colors text-sm"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </Link>
              
              <div className="w-24 h-24 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              
              {isConnected && (
                <div className="mb-4">
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-600/20 text-green-400 border border-green-500/30">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Connected
                  </div>
                </div>
              )}
              
              <h2 className="text-2xl font-bold text-white mb-8">Connect Business Bank Account</h2>
              
              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Beneficiary</label>
                  <input
                    type="text"
                    value={beneficiary}
                    onChange={(e) => setBeneficiary(e.target.value)}
                    placeholder="Boho Beauty Salon"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">IBAN</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="AE 0700 3001 2769 3138 2000 1"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Bank</label>
                  <input
                    type="text"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    placeholder="RAK Bank"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>
              
              <button
                onClick={handleSaveBankAccount}
                disabled={loading}
                className="cosmic-button-primary mt-8 w-full"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}


        </div>

      </div>
    </div>
  )
}