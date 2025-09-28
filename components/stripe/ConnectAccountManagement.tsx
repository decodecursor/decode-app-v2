'use client'

import { useEffect, useRef, useState } from 'react'
import { loadConnectAndInitialize } from '@stripe/connect-js'

interface ConnectAccountManagementProps {
  accountId: string
}

export function ConnectAccountManagement({ accountId }: ConnectAccountManagementProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accountId || !containerRef.current) return

    let mounted = true
    let accountManagement: any = null

    const initializeConnect = async () => {
      try {
        // Fetch account session from API
        const response = await fetch('/api/stripe/account-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            accountId,
            components: ['account_management'] // Specify we want management component
          })
        })

        if (!response.ok) {
          throw new Error('Failed to create account session')
        }

        const { client_secret } = await response.json()

        if (!mounted) return

        // Initialize Stripe Connect
        const stripeConnectInstance = await loadConnectAndInitialize({
          publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
          fetchClientSecret: async () => client_secret
        })

        if (!mounted) return

        // Create account management component
        accountManagement = stripeConnectInstance.create('account-management')

        // Mount the component
        if (containerRef.current && mounted) {
          accountManagement.mount(containerRef.current)
          setLoading(false)
        }

      } catch (err) {
        console.error('Error initializing account management:', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load account management')
          setLoading(false)
        }
      }
    }

    initializeConnect()

    // Cleanup on unmount
    return () => {
      mounted = false
      if (accountManagement) {
        accountManagement.destroy()
      }
    }
  }, [accountId])

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <>
      {loading && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-3">
            <div className="w-6 h-6 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">Loading…</span>
          </div>
        </div>
      )}
      <div 
        ref={containerRef} 
        className={loading ? 'hidden' : ''}
        style={{ minHeight: '400px' }}
      />
    </>
  )
}