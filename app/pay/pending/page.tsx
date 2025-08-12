'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface PaymentPendingDetails {
  id: string
  amount: number
  currency: string
  description: string
  buyerEmail?: string
  timestamp: string
  linkId?: string
}

type PaymentStatus = 'pending' | 'success' | 'failed' | 'timeout'

function PaymentPendingContent() {
  const [pendingDetails, setPendingDetails] = useState<PaymentPendingDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending')
  const [timeoutSeconds, setTimeoutSeconds] = useState(300) // 5 minutes timeout
  const [checkAttempts, setCheckAttempts] = useState(0)
  const maxCheckAttempts = 60 // 5 minutes with 5-second intervals
  
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    // Get pending payment details from URL params
    const id = searchParams.get('id')
    const amount = searchParams.get('amount')
    const currency = searchParams.get('currency') || 'USD'
    const description = searchParams.get('description')
    const buyerEmail = searchParams.get('buyerEmail')
    const timestamp = searchParams.get('timestamp') || new Date().toISOString()
    const linkId = searchParams.get('linkId')

    if (id && amount && description) {
      setPendingDetails({
        id,
        amount: parseFloat(amount),
        currency,
        description,
        buyerEmail: buyerEmail || undefined,
        timestamp,
        linkId: linkId || undefined
      })
    }
    
    setLoading(false)
  }, [searchParams])

  // Countdown timer
  useEffect(() => {
    if (paymentStatus === 'pending' && timeoutSeconds > 0) {
      const timer = setTimeout(() => {
        setTimeoutSeconds(prev => prev - 1)
      }, 1000)
      
      return () => clearTimeout(timer)
    } else if (timeoutSeconds === 0 && paymentStatus === 'pending') {
      setPaymentStatus('timeout')
    }
    
    return () => {}
  }, [timeoutSeconds, paymentStatus])

  // Payment status checking
  useEffect(() => {
    if (!pendingDetails || paymentStatus !== 'pending') return () => {}

    const checkPaymentStatus = async () => {
      try {
        // Check if transaction exists in database
        const { data, error } = await supabase
          .from('transactions')
          .select('status, processor_transaction_id')
          .eq('id', pendingDetails.id)
          .single()

        if (error) {
          console.log('Transaction not found yet, continuing to check...')
          return
        }

        if (data) {
          if (data.status === 'completed') {
            setPaymentStatus('success')
            // Redirect to success page with details
            const params = new URLSearchParams({
              id: pendingDetails.id,
              amount: pendingDetails.amount.toString(),
              currency: pendingDetails.currency,
              description: pendingDetails.description,
              timestamp: pendingDetails.timestamp,
              ...(pendingDetails.buyerEmail && { buyerEmail: pendingDetails.buyerEmail }),
              ...(data.processor_transaction_id && { transactionId: data.processor_transaction_id })
            })
            router.push(`/pay/success?${params.toString()}`)
            return
          } else if (data.status === 'failed') {
            setPaymentStatus('failed')
            // Redirect to failure page
            const params = new URLSearchParams({
              error: 'Payment processing failed',
              ...(pendingDetails.linkId && { linkId: pendingDetails.linkId }),
              amount: pendingDetails.amount.toString(),
              currency: pendingDetails.currency,
              description: pendingDetails.description,
              timestamp: pendingDetails.timestamp
            })
            router.push(`/pay/failed?${params.toString()}`)
            return
          }
        }
      } catch (error) {
        console.error('Error checking payment status:', error)
      }

      setCheckAttempts(prev => prev + 1)
    }

    // Check immediately, then every 5 seconds
    checkPaymentStatus()
    
    if (checkAttempts < maxCheckAttempts) {
      const interval = setInterval(checkPaymentStatus, 5000)
      return () => clearInterval(interval)
    } else {
      // Max attempts reached, consider it timeout
      setPaymentStatus('timeout')
      return () => {}
    }
  }, [pendingDetails, paymentStatus, checkAttempts, maxCheckAttempts, router])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleTimeout = () => {
    if (pendingDetails?.linkId) {
      // Redirect back to payment page
      router.push(`/pay/${pendingDetails.linkId}`)
    } else {
      router.push('/dashboard')
    }
  }

  const getPendingIcon = () => {
    return (
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 bg-yellow-500/20 rounded-full animate-pulse"></div>
        <div className="relative w-20 h-20 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="cosmic-card">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto mb-4"></div>
            <p className="cosmic-body text-center">Loading payment status...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!pendingDetails) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="cosmic-card text-center">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="cosmic-heading mb-4">Payment Status Unknown</h1>
            <p className="cosmic-body opacity-70 mb-6">
              We couldn&apos;t find the payment information to track.
            </p>
            <Link 
              href="/dashboard" 
              className="cosmic-button-primary inline-block payment-back-button"
              onClick={(e) => {
                console.log('Back to Dashboard clicked from pending page');
                e.preventDefault();
                window.location.href = '/dashboard';
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (paymentStatus === 'timeout') {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card max-w-lg w-full text-center">
            {/* Timeout Icon */}
            <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h1 className="cosmic-logo text-orange-400 mb-2">Payment Timeout</h1>
            <p className="cosmic-body opacity-70 mb-6">
              Your payment is taking longer than expected to process
            </p>

            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
              <p className="cosmic-body">
                Don&apos;t worry - your payment may still be processing. Check your email for confirmation or try again.
              </p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handleTimeout}
                className="cosmic-button-primary w-full"
              >
                Try Again
              </button>
              <Link 
                href="/dashboard" 
                className="cosmic-input text-center cosmic-body font-medium hover:bg-white/10 transition-colors block payment-back-button"
                onClick={(e) => {
                  console.log('Back to Dashboard clicked from pending timeout state');
                  e.preventDefault();
                  window.location.href = '/dashboard';
                }}
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="cosmic-card max-w-lg w-full">
          {/* Pending Animation */}
          <div className="text-center mb-8">
            {getPendingIcon()}
            <h1 className="cosmic-logo text-yellow-400 mb-2">Processing Payment</h1>
            <p className="cosmic-body opacity-70">Please wait while we confirm your payment</p>
          </div>

          {/* Payment Details */}
          <div className="space-y-6">
            {/* Status Information */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="cosmic-body text-yellow-300 font-medium">Payment in Progress</p>
                  <p className="cosmic-body opacity-70 text-sm mt-1">
                    We&apos;re confirming your payment with the payment processor. This usually takes a few moments.
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <h3 className="cosmic-label text-white/70 mb-3">Payment Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="cosmic-body opacity-70">Service</span>
                  <span className="cosmic-body">{pendingDetails.description}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="cosmic-body opacity-70">Amount</span>
                  <span className="cosmic-body">${pendingDetails.amount.toFixed(2)} {pendingDetails.currency}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="cosmic-body opacity-70">Started</span>
                  <span className="cosmic-body">{formatDate(pendingDetails.timestamp)}</span>
                </div>
                {pendingDetails.buyerEmail && (
                  <div className="flex justify-between items-center">
                    <span className="cosmic-body opacity-70">Email</span>
                    <span className="cosmic-body">{pendingDetails.buyerEmail}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="cosmic-body">Checking Status</span>
                <span className="cosmic-body text-yellow-400">{formatTime(timeoutSeconds)}</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${((300 - timeoutSeconds) / 300) * 100}%` }}
                ></div>
              </div>
              <p className="cosmic-body opacity-50 text-xs mt-2">
                Check attempt {checkAttempts} of {maxCheckAttempts}
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="cosmic-body text-blue-300 font-medium">What&apos;s happening?</p>
                  <p className="cosmic-body opacity-70 text-sm mt-1">
                    We&apos;re automatically checking your payment status every few seconds. 
                    You&apos;ll be redirected once we receive confirmation.
                  </p>
                </div>
              </div>
            </div>

            {/* Emergency Actions */}
            <div className="border-t border-white/20 pt-6">
              <p className="cosmic-body opacity-50 text-sm text-center mb-4">
                Taking too long? You can check back later or contact support.
              </p>
              <div className="space-y-2">
                <Link 
                  href="/dashboard" 
                  className="cosmic-input text-center cosmic-body font-medium hover:bg-white/10 transition-colors block payment-back-button"
                  onClick={(e) => {
                    console.log('Back to Dashboard clicked from pending processing state');
                    e.preventDefault();
                    window.location.href = '/dashboard';
                  }}
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="cosmic-bg">
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="cosmic-card">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto mb-4"></div>
          <p className="cosmic-body text-center">Loading payment status...</p>
        </div>
      </div>
    </div>
  )
}

export default function PaymentPendingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentPendingContent />
    </Suspense>
  )
}