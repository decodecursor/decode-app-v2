'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import AITextLoading from '@/components/ui/AITextLoading'

interface PaymentFailureDetails {
  error: string
  linkId?: string
  amount?: number
  currency?: string
  description?: string
  timestamp: string
}

function PaymentFailedContent() {
  const [failureDetails, setFailureDetails] = useState<PaymentFailureDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    // Get failure details from URL params
    const error = searchParams.get('error') || 'Payment processing failed'
    const linkId = searchParams.get('linkId')
    const amount = searchParams.get('amount')
    const currency = searchParams.get('currency') || 'USD'
    const description = searchParams.get('description')
    const timestamp = searchParams.get('timestamp') || new Date().toISOString()

    setFailureDetails({
      error,
      linkId: linkId || undefined,
      amount: amount ? parseFloat(amount) : undefined,
      currency,
      description: description || undefined,
      timestamp
    })
    
    setLoading(false)
  }, [searchParams])

  const handleRetryPayment = () => {
    if (failureDetails?.linkId) {
      setRetrying(true)
      // Redirect back to the payment page to retry
      router.push(`/pay/${failureDetails.linkId}`)
    }
  }

  const getErrorIcon = () => {
    return (
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 bg-red-500/20 rounded-full animate-pulse"></div>
        <div className="relative w-20 h-20 bg-gradient-to-r from-red-400 to-red-600 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      </div>
    )
  }

  const getErrorMessage = (error: string) => {
    // Provide user-friendly error messages
    const errorLower = error.toLowerCase()
    
    if (errorLower.includes('insufficient funds') || errorLower.includes('declined')) {
      return {
        title: 'Payment Declined',
        message: 'Your payment method was declined. Please check your account balance or try a different payment method.',
        suggestion: 'Contact your bank if the issue persists.'
      }
    }
    
    if (errorLower.includes('expired') || errorLower.includes('invalid card')) {
      return {
        title: 'Invalid Payment Method',
        message: 'The payment method you provided is invalid or expired.',
        suggestion: 'Please update your payment information and try again.'
      }
    }
    
    if (errorLower.includes('network') || errorLower.includes('connection')) {
      return {
        title: 'Connection Error',
        message: 'We encountered a network issue while processing your payment.',
        suggestion: 'Please check your internet connection and try again.'
      }
    }
    
    if (errorLower.includes('timeout')) {
      return {
        title: 'Payment Timeout',
        message: 'The payment process took too long and timed out.',
        suggestion: 'Please try again. If the issue continues, contact support.'
      }
    }
    
    // Default error message
    return {
      title: 'Payment Failed',
      message: error || 'We encountered an issue processing your payment.',
      suggestion: 'Please try again or contact support if the problem continues.'
    }
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

  if (loading) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="cosmic-card">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto mb-4"></div>
            <p className="cosmic-body text-center">Loading payment details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!failureDetails) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="cosmic-card text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="cosmic-heading mb-4">Payment Error</h1>
            <p className="cosmic-body opacity-70 mb-6">
              We couldn&apos;t retrieve the payment failure details.
            </p>
            <Link 
              href="/dashboard" 
              className="cosmic-button-primary inline-block payment-back-button"
              onClick={(e) => {
                console.log('Back clicked from failed page');
                e.preventDefault();
                window.location.href = '/dashboard';
              }}
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const errorInfo = getErrorMessage(failureDetails.error)

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="cosmic-card max-w-lg w-full">
          {/* Error Animation */}
          <div className="text-center mb-8">
            {getErrorIcon()}
            <h1 className="cosmic-logo text-red-400 mb-2">{errorInfo.title}</h1>
            <p className="cosmic-body opacity-70">We couldn&apos;t process your payment</p>
          </div>

          {/* Error Details */}
          <div className="space-y-6">
            {/* Error Message */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="cosmic-body text-red-300 font-medium">What happened?</p>
                  <p className="cosmic-body opacity-70 text-sm mt-1">
                    {errorInfo.message}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            {(failureDetails.description || failureDetails.amount) && (
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <h3 className="cosmic-label text-white/70 mb-3">Payment Information</h3>
                <div className="space-y-2">
                  {failureDetails.description && (
                    <div className="flex justify-between items-center">
                      <span className="cosmic-body opacity-70">Service</span>
                      <span className="cosmic-body">{failureDetails.description}</span>
                    </div>
                  )}
                  {failureDetails.amount && (
                    <div className="flex justify-between items-center">
                      <span className="cosmic-body opacity-70">Amount</span>
                      <span className="cosmic-body">${failureDetails.amount.toFixed(2)} {failureDetails.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="cosmic-body opacity-70">Failed at</span>
                    <span className="cosmic-body">{formatDate(failureDetails.timestamp)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestion */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="cosmic-body text-blue-300 font-medium">What can you do?</p>
                  <p className="cosmic-body opacity-70 text-sm mt-1">
                    {errorInfo.suggestion}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              {failureDetails.linkId && (
                <button 
                  onClick={handleRetryPayment}
                  disabled={retrying}
                  className="cosmic-button-primary w-full"
                >
                  {retrying ? 'Redirecting...' : 'Try Payment Again'}
                </button>
              )}
              
              <Link
                href="/dashboard"
                className="cosmic-input text-center cosmic-body font-medium hover:bg-white/10 transition-colors block"
              >
                Back
              </Link>
            </div>

            {/* Support Information */}
            <div className="border-t border-white/20 pt-6 text-center">
              <p className="cosmic-body opacity-50 text-sm mb-2">
                Need help? Contact our support team
              </p>
              <div className="space-y-1">
                <p className="cosmic-body text-sm">
                  <span className="opacity-70">Email:</span> support@decode.beauty
                </p>
                <p className="cosmic-body text-sm">
                  <span className="opacity-70">Available:</span> 24/7 for payment issues
                </p>
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
        <div className="rounded-xl overflow-hidden shadow-lg">
          <AITextLoading />
        </div>
      </div>
    </div>
  )
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentFailedContent />
    </Suspense>
  )
}