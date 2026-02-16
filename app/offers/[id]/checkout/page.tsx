'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { StripeElementsOptions } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { stripePromise } from '@/lib/stripe-client'
import { createClient } from '@/utils/supabase/client'


interface OfferDetails {
  title: string
  businessName: string
  price: number
}

// Inner form component (rendered inside <Elements>)
function OfferPaymentForm({
  offerId,
  offerDetails,
  clientSecret,
}: {
  offerId: string
  offerDetails: OfferDetails
  clientSecret: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deviceCapabilities = useMemo(() => {
    const userAgent = navigator.userAgent
    const platform = navigator.platform || ''
    const isIOS =
      /iPhone|iPad|iPod/.test(userAgent) ||
      /iPhone|iPad|iPod/.test(platform) ||
      (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isAndroid = /Android/.test(userAgent)
    const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(userAgent)
    return { isIOS, isAndroid, isMobile }
  }, [])

  useEffect(() => {
    const { isMobile } = deviceCapabilities
    const preventPageAutofocus = () => {
      if (document.activeElement && document.activeElement !== document.body) {
        ;(document.activeElement as HTMLElement).blur()
      }
      if (isMobile) {
        const formContainer = document.querySelector('.offer-checkout-card')
        if (formContainer) {
          formContainer.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
        }
        window.scrollTo({ left: 0, behavior: 'smooth' })
      }
    }
    requestAnimationFrame(preventPageAutofocus)
  }, [deviceCapabilities])

  const expressCheckoutOptions = useMemo(() => {
    const { isIOS, isAndroid } = deviceCapabilities
    const baseConfig = {
      buttonTheme: {
        applePay: 'black' as const,
        googlePay: 'white' as const,
      },
      buttonType: { googlePay: 'plain' as const },
    }
    if (isIOS) {
      return {
        ...baseConfig,
        paymentMethods: { applePay: 'always' as const, googlePay: 'never' as const },
        paymentMethodOrder: ['applePay'],
      }
    } else if (isAndroid) {
      return {
        ...baseConfig,
        paymentMethods: { applePay: 'auto' as const, googlePay: 'always' as const },
        paymentMethodOrder: ['googlePay', 'applePay'],
      }
    }
    return {
      ...baseConfig,
      paymentMethods: { applePay: 'auto' as const, googlePay: 'always' as const },
      paymentMethodOrder: ['googlePay', 'applePay'],
    }
  }, [deviceCapabilities])

  const returnUrl = `${window.location.origin}/offers/purchase/success?payment_intent={PAYMENT_INTENT_ID}&offer_id=${offerId}`

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    try {
      const { error: submitError } = await elements.submit()
      if (submitError) throw new Error(submitError.message)

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: { return_url: returnUrl },
      })
      if (confirmError) throw new Error(confirmError.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setLoading(false)
    }
  }

  const handleExpressConfirm = async () => {
    if (!stripe || !elements) return
    try {
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: { return_url: returnUrl },
      })
      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-2" style={{ background: '#0a0a0a' }}>
      <div
        className="offer-checkout-card max-w-6xl md:max-w-md w-full"
        style={{ transform: 'translateX(0)', margin: '0 auto', position: 'relative', left: '0', right: '0', borderRadius: '12px', padding: '24px' }}
      >
        {/* Offer Info */}
        <div className="px-4 py-6 mb-6">
          <div className="text-center flex flex-col gap-2">
            <div className="text-xs text-white font-extrabold" style={{ fontSize: '18px' }}>
              {offerDetails.title}
            </div>
            <div className="text-xs text-white font-extrabold" style={{ fontSize: '14px' }}>
              {offerDetails.businessName}
            </div>
            <div className="text-xs text-white font-extrabold" style={{ fontSize: '18px' }}>
              AED {offerDetails.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Express Checkout */}
        <div className="mb-4 express-checkout-expanded" style={{ minHeight: '60px' }}>
          <div className="express-checkout-no-border" style={{ minHeight: '56px', display: 'block' }}>
            <ExpressCheckoutElement
              options={expressCheckoutOptions}
              onReady={(event) => {
                const { isIOS, isAndroid } = deviceCapabilities
                if (!event.availablePaymentMethods?.applePay && !event.availablePaymentMethods?.googlePay) {
                  console.warn('No express payment methods available')
                }
                requestAnimationFrame(() => {
                  const showMoreButton = document.querySelector(
                    'button[aria-label*="Show more"], button[aria-label*="show more"]'
                  ) as HTMLButtonElement
                  if (showMoreButton) {
                    if (isIOS || isAndroid) {
                      showMoreButton.classList.add('hidden')
                    } else {
                      showMoreButton.click()
                    }
                  }
                })
              }}
              onConfirm={handleExpressConfirm}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center space-x-4 my-2">
          <div className="flex-1 h-px bg-white/20"></div>
          <span className="!text-sm text-white opacity-60">or pay with card</span>
          <div className="flex-1 h-px bg-white/20"></div>
        </div>

        {/* Card Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div
            style={{ fontSize: '14px', minHeight: '250px', position: 'relative' }}
          >
            <PaymentElement
              options={{
                layout: 'tabs',
                paymentMethodOrder: ['card'],
                wallets: { applePay: 'never', googlePay: 'never' },
              }}
              onReady={() => {
                const { isMobile } = deviceCapabilities
                const preventAutofocus = () => {
                  if (document.activeElement && document.activeElement !== document.body) {
                    ;(document.activeElement as HTMLElement).blur()
                  }
                }
                requestAnimationFrame(() => {
                  preventAutofocus()
                  if (isMobile) {
                    const formContainer = document.querySelector('.offer-checkout-card')
                    if (formContainer) {
                      formContainer.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
                    }
                  }
                })
              }}
            />
          </div>

          {error && (
            <div className="text-red-300 bg-red-900/20 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <button type="submit" disabled={!stripe || loading} className="offers-buy-btn w-full">
            {loading
              ? 'Processing...'
              : `Pay AED ${offerDetails.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </button>
        </form>
      </div>
    </div>
  )
}

// Outer component: fetches payment intent, wraps in <Elements>
export default function OfferCheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const offerId = params.id as string

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [offerDetails, setOfferDetails] = useState<OfferDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      // Auth check
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/auth?redirectTo=/offers/${offerId}&role=Buyer`)
        return
      }

      try {
        const res = await fetch('/api/offers/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offerId }),
        })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to initialize checkout')
          setLoading(false)
          return
        }

        setClientSecret(data.clientSecret)
        setOfferDetails(data.offerDetails)
      } catch {
        setError('Something went wrong. Please try again.')
      }
      setLoading(false)
    }
    init()
  }, [offerId, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a0a' }}>
        <div className="offers-spinner" />
        <p className="text-sm text-white/40 mt-4">Loading...</p>
      </div>
    )
  }

  if (error || !clientSecret || !offerDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a0a' }}>
        <div className="max-w-md w-full text-center" style={{ background: 'rgba(10, 10, 20, 0.85)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '12px', padding: '24px' }}>
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Checkout Error</h1>
          <p className="text-white opacity-80 mb-4">{error || 'Unable to load checkout'}</p>
          <button onClick={() => router.back()} className="offers-buy-btn">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const stripeOptions: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#E1306C',
        colorBackground: '#111111',
        colorText: '#ffffff',
        colorDanger: '#ef4444',
        fontFamily: 'Inter, sans-serif',
        fontSizeBase: '16px',
        borderRadius: '8px',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          backgroundColor: '#111111',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: '#ffffff',
          padding: '8px 12px',
          fontSize: '16px',
          lineHeight: '1.2',
        },
        '.Input:focus': {
          border: '1px solid rgba(255, 255, 255, 0.25)',
          boxShadow: 'none',
        },
        '.Label': {
          color: '#ffffff',
          fontSize: '12px',
          marginBottom: '7px',
        },
      },
    },
  }

  return (
    <Elements stripe={stripePromise} options={stripeOptions}>
      <OfferPaymentForm offerId={offerId} offerDetails={offerDetails} clientSecret={clientSecret} />
    </Elements>
  )
}
