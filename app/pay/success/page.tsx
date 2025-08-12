'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface PaymentDetails {
  id: string
  amount: number
  currency: string
  description: string
  clientName?: string
  timestamp: string
}

function PaymentSuccessContent() {
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()

  // Update transaction status to completed
  const markPaymentAsPaid = async (paymentLinkId: string, paymentIntent?: string) => {
    try {
      console.log('✅ SUCCESS PAGE: Marking payment as completed for link:', paymentLinkId);
      
      // Call the update-transaction API to mark transaction as completed
      // This will trigger the database trigger to update paid_at
      try {
        console.log('🔄 Calling update-transaction API...');
        const response = await fetch('/api/payment/update-transaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentLinkId,
            paymentIntentId: paymentIntent
          }),
        });

        const result = await response.json();
        
        if (response.ok) {
          console.log('✅ Transaction updated successfully:', result);
          console.log('✅ Database trigger should now update paid_at timestamp');
        } else {
          console.error('❌ Failed to update transaction:', result.error);
        }
      } catch (error) {
        console.error('❌ Exception during transaction update:', error);
      }
      
    } catch (error) {
      console.error('❌ Error marking payment as completed:', error);
    }
  };

  useEffect(() => {
    // Get payment details from URL params
    console.log('🔍 Success page - All URL params:', Object.fromEntries(searchParams.entries()))
    
    const id = searchParams.get('id')
    const amount = searchParams.get('amount')
    const currency = searchParams.get('currency') || 'AED'
    const description = searchParams.get('description')
    const clientName = searchParams.get('clientName')
    const timestamp = searchParams.get('timestamp')
    
    // Extract payment intent from Stripe redirect
    const paymentIntent = searchParams.get('payment_intent')
    const paymentIntentClientSecret = searchParams.get('payment_intent_client_secret')
    const redirectStatus = searchParams.get('redirect_status')
    
    console.log('💰 Parsed params:', { id, amount, currency, description, clientName, timestamp })
    console.log('💳 Stripe params:', { paymentIntent, redirectStatus, hasClientSecret: !!paymentIntentClientSecret })

    if (id && amount && description && timestamp) {
      console.log('✅ All required params present - setting payment details')
      console.log('✅ Payment redirect status:', redirectStatus)
      
      setPaymentDetails({
        id,
        amount: parseFloat(amount),
        currency,
        description,
        clientName: clientName || undefined,
        timestamp
      })
      
      // Mark payment as completed with payment intent if available
      markPaymentAsPaid(id, paymentIntent || undefined)
    } else {
      console.log('❌ Missing required params:', { 
        hasId: !!id, 
        hasAmount: !!amount, 
        hasDescription: !!description, 
        hasTimestamp: !!timestamp 
      })
    }
    
    setLoading(false)
  }, [searchParams])


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
            <Link 
              href="/dashboard" 
              className="cosmic-button-primary inline-block payment-back-button"
              onClick={(e) => {
                console.log('Back to Dashboard clicked from success page');
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

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="cosmic-card max-w-lg w-full text-center">
          {/* Success Animation */}
          <div className="mb-8">
            <div className="relative w-14 h-14 mx-auto mb-4">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
              <div className="relative w-14 h-14 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center">
                <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="cosmic-logo text-green-400 mb-2">Payment Successful</h1>
            <p className="cosmic-body opacity-70 mb-4">Your payment has been processed successfully</p>
          </div>

          {/* Payment Details */}
          <div className="bg-black rounded-lg p-6 mb-6">
            <p className="cosmic-body text-white mb-2">{paymentDetails.description}</p>
            <p className="cosmic-body text-white">
              {paymentDetails.clientName || 'Client Name'}
            </p>
            <p className="cosmic-body text-white mt-2">
              Service by Boho Beauty Salon
            </p>
          </div>

          {/* Personalized Thank You Message */}
          <div>
            <p className="cosmic-body text-white text-lg">
              ❤️ Thank you so much, {paymentDetails.clientName || 'Client'} ❤️
            </p>
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
          <p className="cosmic-body text-center">Loading payment details...</p>
        </div>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  )
}