'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface PaymentDetails {
  id: string
  amount: number
  currency: string
  description: string
  buyerEmail?: string
  timestamp: string
  transactionId?: string
}

export default function PaymentSuccessPage() {
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()

  useEffect(() => {
    // Get payment details from URL params
    const id = searchParams.get('id')
    const amount = searchParams.get('amount')
    const currency = searchParams.get('currency') || 'USD'
    const description = searchParams.get('description')
    const buyerEmail = searchParams.get('buyerEmail')
    const timestamp = searchParams.get('timestamp')
    const transactionId = searchParams.get('transactionId')

    if (id && amount && description && timestamp) {
      setPaymentDetails({
        id,
        amount: parseFloat(amount),
        currency,
        description,
        buyerEmail: buyerEmail || undefined,
        timestamp,
        transactionId: transactionId || undefined
      })
    }
    
    setLoading(false)
  }, [searchParams])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const copyTransactionId = () => {
    if (paymentDetails?.id) {
      navigator.clipboard.writeText(paymentDetails.id)
    }
  }

  if (loading) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="cosmic-card">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto mb-4"></div>
            <p className="cosmic-body text-center">Loading payment confirmation...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!paymentDetails) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="cosmic-card text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="cosmic-heading mb-4">Payment Details Not Found</h1>
            <p className="cosmic-body opacity-70 mb-6">
              We couldn&apos;t find the payment confirmation details. Please check your email for the receipt.
            </p>
            <Link href="/dashboard" className="cosmic-button-primary inline-block">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="cosmic-card max-w-lg w-full">
          {/* Success Animation */}
          <div className="text-center mb-8">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
              <div className="relative w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="cosmic-logo text-green-400 mb-2">Payment Successful!</h1>
            <p className="cosmic-body opacity-70">Your payment has been processed successfully</p>
          </div>

          {/* Payment Details */}
          <div className="space-y-6">
            {/* Service Information */}
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <h3 className="cosmic-label text-white/70 mb-2">Service</h3>
              <p className="cosmic-body font-medium">{paymentDetails.description}</p>
            </div>

            {/* Amount */}
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <h3 className="cosmic-label text-white/70 mb-2">Amount Paid</h3>
              <p className="text-2xl font-bold text-green-400">
                ${paymentDetails.amount.toFixed(2)} {paymentDetails.currency}
              </p>
            </div>

            {/* Transaction Details */}
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <h3 className="cosmic-label text-white/70 mb-3">Transaction Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="cosmic-body opacity-70">Date</span>
                  <span className="cosmic-body">{formatDate(paymentDetails.timestamp)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="cosmic-body opacity-70">Transaction ID</span>
                  <button 
                    onClick={copyTransactionId}
                    className="cosmic-body text-green-400 hover:text-green-300 transition-colors"
                    title="Click to copy"
                  >
                    {paymentDetails.id.slice(0, 12)}...
                  </button>
                </div>
                {paymentDetails.buyerEmail && (
                  <div className="flex justify-between items-center">
                    <span className="cosmic-body opacity-70">Email</span>
                    <span className="cosmic-body">{paymentDetails.buyerEmail}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation Message */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="cosmic-body text-green-300 font-medium">Payment Confirmed</p>
                  <p className="cosmic-body opacity-70 text-sm mt-1">
                    {paymentDetails.buyerEmail 
                      ? 'A receipt has been sent to your email address.'
                      : 'Please save this page or screenshot for your records.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              <button 
                onClick={() => window.print()}
                className="cosmic-input text-center cosmic-body font-medium hover:bg-white/10 transition-colors cursor-pointer"
              >
                Print Receipt
              </button>
              <Link 
                href="/dashboard" 
                className="cosmic-button-primary block text-center"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/20 pt-6 mt-8 text-center">
            <p className="cosmic-body opacity-50 text-sm">
              Thank you for using DECODE Beauty Payment Platform
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}