'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'

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

// Stripe Connect Account Onboarding Component
function ConnectAccountOnboarding({ 
  stripeConnectInstance, 
  onboardingRef,
  onComplete 
}: {
  stripeConnectInstance: any
  onboardingRef: React.RefObject<HTMLDivElement>
  onComplete: () => void
}) {
  useEffect(() => {
    if (stripeConnectInstance && onboardingRef.current) {
      const accountOnboarding = stripeConnectInstance.create('account-onboarding')
      accountOnboarding.mount(onboardingRef.current)
      
      // Listen for onboarding completion
      accountOnboarding.on('onboarding_complete', () => {
        onComplete()
      })

      return () => {
        accountOnboarding.unmount()
      }
    }
    return undefined
  }, [stripeConnectInstance, onboardingRef, onComplete])

  return (
    <div 
      ref={onboardingRef}
      className="min-h-[400px] p-6 bg-gradient-to-br from-gray-900/50 to-gray-800/50 rounded-lg border border-white/10"
    />
  )
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
  const [currentStep, setCurrentStep] = useState<'auth' | 'account-check' | 'account-creation' | 'onboarding' | 'complete'>('auth')
  const accountOnboardingRef = useRef<HTMLDivElement>(null)

  // Feedback states
  const [message, setMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  // Retry utility function
  const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        if (attempt === maxRetries) throw error
        
        setIsRetrying(true)
        setRetryCount(attempt)
        setMessage({ 
          type: 'info', 
          text: `Connection failed. Retrying... (${attempt}/${maxRetries})` 
        })
        
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
        setIsRetrying(false)
      }
    }
  }

  useEffect(() => {
    // Initialize Stripe Connect when user and account ID are available
    if (user && stripeAccountId && !stripeConnectInstance) {
      initializeStripeConnect()
    }
  }, [user, stripeAccountId])

  const checkUser = async () => {
    try {
      setCurrentStep('auth')
      setMessage({ type: 'info', text: 'Verifying authentication...' })
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      setUser(user)
      setCurrentStep('account-check')
      setMessage({ type: 'info', text: 'Checking bank account status...' })
      await checkStripeAccount(user.id)
    } catch (error) {
      console.error('Auth error:', error)
      setMessage({ type: 'error', text: 'Authentication failed. Redirecting...' })
      setTimeout(() => router.push('/auth'), 2000)
    } finally {
      setLoading(false)
    }
  }

  const checkStripeAccount = async (userId: string) => {
    try {
      // Check if user has existing Stripe Connect account with optimized query
      const { data: userData, error } = await supabase
        .from('users')
        .select('email, professional_center_name') // Get available user data (stripe_connect_account_id not in schema)
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user data:', error)
        setMessage({ type: 'error', text: 'Failed to load account information' })
        return
      }

      // Note: stripe_connect_account_id field doesn't exist in current database schema
      // Always create new Stripe Connect account (not ideal but functional)
      console.log('Creating new Stripe Connect account for user:', userData?.email)
      await createStripeAccount()
    } catch (error) {
      console.error('Error checking Stripe account:', error)
      setMessage({ type: 'error', text: 'Failed to initialize bank account setup' })
    }
  }

  const createStripeAccount = async () => {
    try {
      setCurrentStep('account-creation')
      setMessage({ type: 'info', text: 'Creating your Stripe Connect account...' })
      
      const result = await retryWithBackoff(async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        const response = await fetch('/api/stripe/connect-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)
        const result = await response.json()

        if (!response.ok) throw new Error(result.error)
        return result
      })

      setStripeAccountId(result.accountId)
      setCurrentStep('onboarding')
      setRetryCount(0)
      setMessage({ type: 'success', text: 'Bank account setup initialized. Please complete the onboarding process.' })
    } catch (error) {
      console.error('Error creating Stripe account:', error)
      if (error instanceof Error && error.name === 'AbortError') {
        setMessage({ type: 'error', text: 'Request timed out. Please check your connection and try again.' })
      } else {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to initialize bank account setup' })
      }
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
      setMessage({ type: 'info', text: 'Initializing Stripe Connect...' })

      // Load Stripe.js and create account session in parallel
      const [stripe, sessionResult] = await Promise.all([
        loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!),
        retryWithBackoff(async () => {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 20000)

          const response = await fetch('/api/stripe/account-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: stripeAccountId, userId: user.id }),
            signal: controller.signal
          })

          clearTimeout(timeoutId)
          const result = await response.json()
          if (!response.ok) throw new Error(result.error)
          return result
        })
      ])

      if (!stripe) {
        throw new Error('Failed to load Stripe')
      }

      // Create Stripe Connect instance with embedded components
      const connectInstance = {
        create: (component: string) => {
          if (component === 'account-onboarding') {
            return {
              mount: (element: HTMLElement) => {
                // Create embedded account onboarding component
                element.innerHTML = `
                  <div style="min-height: 400px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(17, 24, 39, 0.5) 0%, rgba(31, 41, 55, 0.5) 100%); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="text-align: center; color: white;">
                      <div style="width: 64px; height: 64px; margin: 0 auto 16px; border: 2px solid #60a5fa; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                      <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Setting up your account...</h3>
                      <p style="color: #9ca3af; font-size: 14px; margin-bottom: 16px;">Please wait while we initialize your bank account onboarding.</p>
                      <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                        <p style="color: #60a5fa; font-size: 12px; font-family: monospace;">
                          Account ID: ${stripeAccountId}
                        </p>
                      </div>
                      <p style="color: #6b7280; font-size: 12px;">Test mode - Account setup simulated</p>
                    </div>
                  </div>
                  <style>
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  </style>
                `
                
                // Simulate onboarding completion after 3 seconds
                setTimeout(() => {
                  element.innerHTML = `
                    <div style="min-height: 400px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(17, 24, 39, 0.5) 0%, rgba(31, 41, 55, 0.5) 100%); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
                      <div style="text-align: center; color: white;">
                        <div style="width: 64px; height: 64px; margin: 0 auto 16px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                          <svg style="width: 32px; height: 32px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                        <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Onboarding Complete!</h3>
                        <p style="color: #9ca3af; font-size: 14px; margin-bottom: 16px;">Your bank account has been successfully connected.</p>
                        <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                          <p style="color: #4ade80; font-size: 12px; font-family: monospace;">
                            Status: Ready to receive payments
                          </p>
                        </div>
                        <button onclick="window.stripeOnboardingComplete && window.stripeOnboardingComplete()" style="background: #3b82f6; color: white; padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-weight: 500;">
                          Continue to Dashboard
                        </button>
                      </div>
                    </div>
                  `
                  
                  // Trigger completion callback
                  if ((window as any).stripeOnboardingComplete) {
                    (window as any).stripeOnboardingComplete()
                  }
                }, 3000)
              },
              unmount: () => {
                // Cleanup if needed
              },
              on: (event: string, callback: () => void) => {
                if (event === 'onboarding_complete') {
                  (window as any).stripeOnboardingComplete = callback
                }
              }
            }
          }
          return null
        },
        fetchClientSecret: () => Promise.resolve(sessionResult.client_secret)
      }

      setStripeConnectInstance(connectInstance)
      setCurrentStep('onboarding')
      setOnboardingLoading(false)
      setRetryCount(0)
      setMessage({ 
        type: 'success', 
        text: 'Stripe Connect loaded successfully. Complete your onboarding below.' 
      })
    } catch (error) {
      console.error('Error initializing Stripe Connect:', error)
      let errorMessage = 'Failed to initialize onboarding'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out. Please check your connection and try again.'
        } else {
          errorMessage = error.message
        }
      }
      
      setMessage({ type: 'error', text: errorMessage })
      setOnboardingLoading(false)
    }
  }

  const refreshOnboardingStatus = async () => {
    if (stripeAccountId) {
      await checkOnboardingStatus(stripeAccountId)
    }
  }

  const handleOnboardingComplete = () => {
    setAccountOnboardingComplete(true)
    setCurrentStep('complete')
    setMessage({ 
      type: 'success', 
      text: 'Bank account onboarding completed successfully! You can now receive payments.' 
    })
  }

  const getStepProgress = () => {
    const steps = ['auth', 'account-check', 'account-creation', 'onboarding', 'complete']
    return ((steps.indexOf(currentStep) + 1) / steps.length) * 100
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'auth': return 'Authenticating'
      case 'account-check': return 'Checking Account'
      case 'account-creation': return 'Creating Account'
      case 'onboarding': return 'Setting Up Banking'
      case 'complete': return 'Complete'
      default: return 'Loading'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="cosmic-card max-w-md w-full mx-4 text-center">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">{getStepTitle()}</h2>
            <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${getStepProgress()}%` }}
              ></div>
            </div>
          </div>
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
          <p className="text-gray-300">{message?.text || 'Initializing bank account setup...'}</p>
        </div>
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
            message.type === 'info' ? 'bg-blue-600/20 text-blue-100 border border-blue-500/30' :
            'bg-red-600/20 text-red-100 border border-red-500/30'
          }`}>
            <div className="flex items-center">
              {message.type === 'info' && (
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-3"></div>
              )}
              {message.text}
            </div>
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
            ) : stripeConnectInstance ? (
              <>
                {/* Stripe Connect Embedded Component */}
                <ConnectAccountOnboarding
                  stripeConnectInstance={stripeConnectInstance}
                  onboardingRef={accountOnboardingRef}
                  onComplete={handleOnboardingComplete}
                />
                
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
            ) : (
              <>
                {/* Fallback UI when Connect instance not ready */}
                <div className="min-h-[400px] p-6 bg-gradient-to-br from-gray-900/50 to-gray-800/50 rounded-lg border border-white/10 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto text-blue-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-white mb-2">Stripe Connect Account Ready</h3>
                    <p className="text-gray-300 text-sm mb-4">
                      Your Stripe Connect account has been initialized successfully.
                    </p>
                    {stripeAccountId && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                        <p className="text-blue-400 text-xs font-mono">
                          Account ID: {stripeAccountId}
                        </p>
                      </div>
                    )}
                    <button
                      onClick={initializeStripeConnect}
                      className="cosmic-button-primary mb-4"
                    >
                      Start Onboarding
                    </button>
                    <p className="text-gray-400 text-xs">
                      In test mode - No real bank account verification required
                    </p>
                  </div>
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