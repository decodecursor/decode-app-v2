'use client'

import { useEffect, useRef, useState } from 'react'
import { loadConnectAndInitialize } from '@stripe/connect-js'

interface ConnectNotificationBannerProps {
  accountId: string
}

export function ConnectNotificationBanner({ accountId }: ConnectNotificationBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [hasNotifications, setHasNotifications] = useState(false)

  useEffect(() => {
    if (!accountId || !containerRef.current) return

    let mounted = true
    let notificationBanner: any = null

    const initializeConnect = async () => {
      try {
        // Fetch account session from API
        const response = await fetch('/api/stripe/account-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            accountId,
            components: ['notification_banner']
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

        // Create notification banner component
        notificationBanner = await stripeConnectInstance.create('notification-banner')

        // Set up event listeners
        notificationBanner.on('change', (event: any) => {
          setHasNotifications(event.hasNotifications)
        })

        // Mount the component
        if (containerRef.current && mounted) {
          notificationBanner.mount(containerRef.current)
          setLoading(false)
        }

      } catch (err) {
        console.error('Error initializing notification banner:', err)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeConnect()

    // Cleanup on unmount
    return () => {
      mounted = false
      if (notificationBanner) {
        notificationBanner.destroy()
      }
    }
  }, [accountId])

  // Only show container if there are notifications
  if (loading || !hasNotifications) {
    return null
  }

  return (
    <div className="mb-4">
      <div ref={containerRef} />
    </div>
  )
}