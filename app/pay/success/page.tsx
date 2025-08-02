'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

  // Simple payment status update
  const markPaymentAsPaid = async (paymentLinkId: string) => {
    try {
      console.log('✅ SUCCESS PAGE: Marking payment as paid for link:', paymentLinkId);
      
      // Try to update is_paid to true using admin client for reliable real-time updates
      try {
        console.log('🔄 Updating payment status with admin client...');
        const { error } = await (supabaseAdmin as any)
          .from('payment_links')
          .update({ is_paid: true })
          .eq('id', paymentLinkId);

        if (error) {
          console.error('❌ Failed to mark payment as paid (column may not exist yet):', error);
          console.error('❌ Error details:', JSON.stringify(error, null, 2));
        } else {
          console.log('✅ Payment link marked as paid successfully with admin client');
          console.log('✅ Real-time update should be triggered now');
        }
      } catch (error) {
        console.error('❌ Exception during payment status update:', error);
        console.log('ℹ️ is_paid column not available yet, payment tracking will work after database migration');
      }
      
    } catch (error) {
      console.error('❌ Error marking payment as paid:', error);
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
      
      // Mark payment as paid
      markPaymentAsPaid(id)
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
        <div className="cosmic-card max-w-lg w-full text-center">
          {/* Success Animation */}
          <div className="mb-8">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
              <div className="relative w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="cosmic-logo text-green-400 mb-2">Payment Successful</h1>
            <p className="cosmic-body opacity-70">Your payment has been processed successfully</p>
          </div>

          {/* Personalized Thank You Message */}
          <div className="mt-8">
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