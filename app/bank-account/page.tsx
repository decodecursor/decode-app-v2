'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadStripe } from '@stripe/stripe-js'

interface ConnectComponentsOptions {
  fonts?: Array<{
    family?: string
    src?: string
    style?: string
    weight?: string
    display?: string
  }>
}

interface StripeConnectInstance {
  create: (component: string, options?: any) => any
  fetchClientSecret: () => Promise<string>
}

// Remove duplicate Stripe global declaration - already exists in @stripe/stripe-js

export default function BankAccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(null)
  const [accountOnboardingComplete, setAccountOnboardingComplete] = useState(false)
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const accountOnboardingRef = useRef<HTMLDivElement>(null)

  // Feedback states
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    // Initialize Stripe Connect when user and account ID are available
    if (user && stripeAccountId && !stripeConnectInstance) {
      initializeStripeConnect()
    }
  }, [user, stripeAccountId])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      setUser(user)
      await checkStripeAccount(user.id)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/auth')
    } finally {
      setLoading(false)
    }
  }

  const checkStripeAccount = async (userId: string) => {
    try {
      // Check if user has existing Stripe Connect account
      const { data: userData, error } = await supabase
        .from('users')
        .select('stripe_connect_account_id')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user data:', error)
        setMessage({ type: 'error', text: 'Failed to load account information' })
        return
      }

      if (userData?.stripe_connect_account_id) {
        setStripeAccountId(userData.stripe_connect_account_id)
        // Check if onboarding is complete
        await checkOnboardingStatus(userData.stripe_connect_account_id)
      } else {
        // Create new Stripe Connect account
        await createStripeAccount()
      }
    } catch (error) {
      console.error('Error checking Stripe account:', error)
      setMessage({ type: 'error', text: 'Failed to initialize bank account setup' })
    }
  }

  const createStripeAccount = async () => {
    try {
      const response = await fetch('/api/stripe/connect-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      setStripeAccountId(result.accountId)
      setMessage({ type: 'success', text: 'Bank account setup initialized. Please complete the onboarding process.' })
    } catch (error) {
      console.error('Error creating Stripe account:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to initialize bank account setup' })
    }
  }

  const checkOnboardingStatus = async (accountId: string) => {
    try {
      // In a real implementation, you would check the account status via Stripe API
      // For now, we'll assume onboarding is needed
      setAccountOnboardingComplete(false)
    } catch (error) {
      console.error('Error checking onboarding status:', error)
    }
  }

  const initializeStripeConnect = async () => {
    try {
      setOnboardingLoading(true)
      
      // Load Stripe.js
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
      if (!stripe) {
        throw new Error('Failed to load Stripe')
      }

      // Create account session
      const response = await fetch('/api/stripe/account-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: stripeAccountId, userId: user.id })
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      // Initialize Stripe Connect
      const stripeConnectInstance = stripe.connectInstance({
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#667eea',
            colorBackground: 'rgba(255, 255, 255, 0.1)',
            colorText: '#ffffff',
            colorDanger: '#ef4444',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '8px'
          }
        },
        fonts: [
          {
            family: 'Inter',
            src: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap'
          }
        ]
      })

      setStripeConnectInstance(stripeConnectInstance)

      // Create and mount the account onboarding component
      if (accountOnboardingRef.current) {
        const accountOnboarding = stripeConnectInstance.create('account-onboarding', {
          clientSecret: result.client_secret
        })

        accountOnboarding.mount('#account-onboarding')

        // Listen for onboarding completion
        accountOnboarding.on('ready', () => {
          setOnboardingLoading(false)
        })

        accountOnboarding.on('complete', () => {
          setAccountOnboardingComplete(true)
          setMessage({ type: 'success', text: 'Bank account onboarding completed successfully!' })
        })

        accountOnboarding.on('error', (error: any) => {
          console.error('Stripe Connect error:', error)
          setMessage({ type: 'error', text: 'An error occurred during onboarding. Please try again.' })
        })
      }
    } catch (error) {
      console.error('Error initializing Stripe Connect:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to initialize onboarding' })
      setOnboardingLoading(false)
    }
  }

  const refreshOnboardingStatus = async () => {
    if (stripeAccountId) {
      await checkOnboardingStatus(stripeAccountId)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading bank accounts...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center text-gray-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white">Bank Account Management</h1>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-600/20 text-green-100 border border-green-500/30' : 
            'bg-red-600/20 text-red-100 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Stripe Connect Onboarding */}
        {stripeAccountId && !accountOnboardingComplete && (
          <div className="cosmic-card">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">Bank Account Setup</h2>
              <p className="text-gray-400">
                Complete the secure onboarding process to add your bank account for receiving payments.
              </p>
            </div>

            {onboardingLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
                <p className="text-white">Loading bank account setup...</p>
              </div>
            ) : (
              <>
                {/* Stripe Connect Component Container */}
                <div 
                  id="account-onboarding" 
                  ref={accountOnboardingRef}
                  className="min-h-[400px] p-4 bg-gradient-to-br from-gray-900/50 to-gray-800/50 rounded-lg border border-white/10"
                >
                  {/* Stripe component will be mounted here */}
                </div>
                
                <div className="mt-6 flex justify-between items-center">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="cosmic-button-secondary"
                  >
                    Back to Dashboard
                  </button>
                  <button
                    onClick={refreshOnboardingStatus}
                    className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    Refresh Status
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Onboarding Complete State */}
        {accountOnboardingComplete && (
          <div className="cosmic-card text-center py-12">
            <svg className="w-16 h-16 mx-auto text-green-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">Bank Account Connected!</h3>
            <p className="text-gray-400 mb-6">
              Your bank account has been successfully connected and verified. You can now receive payments.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="cosmic-button-primary"
            >
              Return to Dashboard
            </button>
          </div>
        )}

        {/* Loading State */}
        {!stripeAccountId && !accountOnboardingComplete && (
          <div className="cosmic-card text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
            <h3 className="text-xl font-semibold text-white mb-2">Setting up your account...</h3>
            <p className="text-gray-400">Please wait while we prepare your bank account onboarding.</p>
          </div>
        )}
      </div>
    </div>
  )
}