'use client'

import { useEffect, useRef, useState } from 'react'
import { loadConnectAndInitialize } from '@stripe/connect-js'
import { ConnectComponentWrapper } from './ConnectComponentWrapper'

interface ConnectOnboardingProps {
  accountId: string
  onExit?: () => void
  onComplete?: () => void
}

export function ConnectOnboarding({ accountId, onExit, onComplete }: ConnectOnboardingProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId || !containerRef.current) return

    let mounted = true
    let accountOnboarding: any = null

    const initializeConnect = async () => {
      try {
        console.log('🚀 Initializing Connect onboarding for account:', accountId)
        
        // Fetch account session from API
        console.log('📡 Fetching account session...')
        const response = await fetch('/api/stripe/account-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId })
        })

        if (!response.ok) {
          const errorData = await response.text()
          console.error('❌ Account session creation failed:', response.status, errorData)
          throw new Error(`Failed to create account session: ${response.status} ${errorData}`)
        }

        const { client_secret } = await response.json()
        console.log('✅ Account session created successfully')

        if (!mounted) {
          console.log('⚠️ Component unmounted during session creation')
          return
        }

        // Initialize Stripe Connect
        console.log('🔄 Loading Stripe Connect...')
        const stripeConnectInstance = await loadConnectAndInitialize({
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
          fetchClientSecret: async () => client_secret
        })
        console.log('✅ Stripe Connect loaded successfully')

        if (!mounted) {
          console.log('⚠️ Component unmounted during Stripe Connect loading')
          return
        }

        // Create account onboarding component
        console.log('🔄 Creating account onboarding component...')
        accountOnboarding = stripeConnectInstance.create('account-onboarding')
        console.log('✅ Account onboarding component created')

        // Note: Standard accounts don't support .on() event listeners (only Express accounts do)
        // We rely on status polling below to detect completion

        // Mount the component
        if (containerRef.current && mounted) {
          console.log('🔄 Mounting onboarding component...')
          accountOnboarding.mount(containerRef.current)
          console.log('✅ Onboarding component mounted successfully')
          setLoading(false)
        } else {
          console.error('❌ Cannot mount: containerRef or mounted check failed', {
            hasContainer: !!containerRef.current,
            mounted
          })
        }

        // Check account status periodically
        const checkStatus = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/stripe/account-status?accountId=${accountId}`)
            if (statusResponse.ok) {
              const { isComplete } = await statusResponse.json()
              if (isComplete && mounted) {
                clearInterval(checkStatus)
                onComplete?.()
              }
            }
          } catch (err) {
            console.error('Error checking status:', err)
          }
        }, 5000) // Check every 5 seconds

        // Cleanup interval on unmount
        return () => {
          clearInterval(checkStatus)
        }

      } catch (err) {
        console.error('💥 Error initializing Connect onboarding:', err)
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to initialize onboarding'
          console.error('❌ Setting error state:', errorMessage)
          setError(errorMessage)
          setLoading(false)
        }
        return () => {} // Return empty cleanup function
      }
    }

    initializeConnect()

    // Cleanup on unmount
    return () => {
      mounted = false
      if (accountOnboarding) {
        accountOnboarding.destroy()
      }
    }
  }, [accountId, onExit, onComplete])

  if (error) {
    return (
      <div className="cosmic-card">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Onboarding Error</h3>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <ConnectComponentWrapper 
      title="Complete Your Account Setup"
      description="Please provide the required information to start receiving payments. This process is secure and typically takes just a few minutes."
    >
      {loading && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-3">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-300">Loading onboarding form...</span>
          </div>
        </div>
      )}
      <div 
        ref={containerRef} 
        className={loading ? 'hidden' : ''}
        style={{ minHeight: '600px' }}
      />
    </ConnectComponentWrapper>
  )
}