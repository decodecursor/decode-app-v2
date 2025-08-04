'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ConnectOnboarding } from '@/components/stripe/ConnectOnboarding'
import { ConnectAccountManagement } from '@/components/stripe/ConnectAccountManagement'
import { ConnectNotificationBanner } from '@/components/stripe/ConnectNotificationBanner'
import { VerificationBadge } from '@/components/stripe/VerificationBadge'
import { BankAccountCard } from '@/components/stripe/BankAccountCard'
import { AccountStatusOverview } from '@/components/stripe/AccountStatusOverview'
import { ConnectComponentWrapper } from '@/components/stripe/ConnectComponentWrapper'
import { OnboardingProgress } from '@/components/stripe/OnboardingProgress'
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

  useEffect(() => {
    checkUser()
  }, [])

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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/dashboard"
            className="flex items-center text-gray-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white">Bank Account Management</h1>
        </div>

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

        {/* Progress Indicator */}
        {currentStep !== 'loading' && (
          <OnboardingProgress currentStep={currentStep === 'create' ? 'create' : currentStep} />
        )}

        {/* Main Content */}
        <div className="space-y-6">
          {currentStep === 'create' && (
            <div className="cosmic-card text-center py-12">
              <div className="w-24 h-24 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Connect Your Bank Account</h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                To receive weekly payouts from your beauty services, you need to connect a UAE bank account.
              </p>
              <button
                onClick={createStripeAccount}
                className="cosmic-button-primary"
              >
                Start Bank Account Setup
              </button>
            </div>
          )}

          {currentStep === 'onboarding' && stripeAccountId && (
            <ConnectOnboarding
              accountId={stripeAccountId}
              onExit={handleOnboardingExit}
              onComplete={handleOnboardingComplete}
            />
          )}

          {currentStep === 'complete' && stripeAccountId && (
            <>
              {/* Account Status Overview */}
              <AccountStatusOverview
                status={accountStatus}
                balance={balance.available}
                pending={balance.pending}
                currency={balance.currency}
                nextPayoutDate={nextPayoutDate}
              />

              {/* Bank Accounts */}
              <div className="cosmic-card">
                <h2 className="text-xl font-semibold text-white mb-6">Connected Bank Accounts</h2>
                
                {bankAccounts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bankAccounts.map((account) => (
                      <BankAccountCard
                        key={account.id}
                        bankName={account.bank_name}
                        accountNumber={`****${account.account_number.slice(-4)}`}
                        accountHolderName={account.account_holder_name}
                        isPrimary={account.is_primary}
                        isVerified={account.is_verified}
                        status={account.status}
                        onSetPrimary={bankAccounts.length > 1 && !account.is_primary ? () => {
                          setShowConfirmDialog({ show: true, action: 'setPrimary', accountId: account.id })
                        } : undefined}
                        onRemove={bankAccounts.length > 1 ? () => {
                          setShowConfirmDialog({ show: true, action: 'remove', accountId: account.id })
                        } : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <p className="text-gray-400">No bank accounts found.</p>
                    <p className="text-gray-500 text-sm mt-1">They will appear here once configured through the account management section.</p>
                  </div>
                )}
              </div>

              {/* Payout History */}
              {user && <PayoutHistory userId={user.id} />}

              {/* Account Management */}
              <ConnectComponentWrapper 
                title="Account Management"
                description="Update your business information, bank account details, or view additional settings."
              >
                <ConnectAccountManagement accountId={stripeAccountId} />
              </ConnectComponentWrapper>
            </>
          )}
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="cosmic-card max-w-md w-full">
              <h3 className="text-xl font-semibold text-white mb-4">
                {showConfirmDialog.action === 'remove' ? 'Remove Bank Account?' : 'Set as Primary Account?'}
              </h3>
              <p className="text-gray-400 mb-6">
                {showConfirmDialog.action === 'remove' 
                  ? 'Are you sure you want to remove this bank account? This action cannot be undone.'
                  : 'This will set this account as your primary bank account for receiving payouts.'}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmDialog({ show: false, action: null, accountId: null })}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (showConfirmDialog.accountId) {
                      if (showConfirmDialog.action === 'remove') {
                        handleRemoveAccount(showConfirmDialog.accountId)
                      } else {
                        handleSetPrimary(showConfirmDialog.accountId)
                      }
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    showConfirmDialog.action === 'remove' 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'cosmic-button-primary'
                  }`}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : showConfirmDialog.action === 'remove' ? 'Remove' : 'Set as Primary'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}