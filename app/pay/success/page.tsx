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

  // Manual transaction status update as fallback for webhook failures
  const manualTransactionUpdate = async (paymentLinkId: string) => {
    try {
      console.log('🔄 SUCCESS PAGE: Attempting manual transaction status update for:', paymentLinkId);
      
      // Find transactions for this payment link that need completion
      const { data: transactions, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('payment_link_id', paymentLinkId)
        .in('status', ['pending']);

      if (fetchError) {
        console.error('❌ SUCCESS PAGE: Error fetching transactions:', fetchError);
        return;
      }

      console.log('🔍 SUCCESS PAGE: Found transactions needing completion:', transactions);

      if (!transactions || transactions.length === 0) {
        console.log('ℹ️ SUCCESS PAGE: No pending transactions found for manual update');
        return;
      }

      // Update all pending transactions to completed
      for (const transaction of transactions) {
        console.log('🔄 SUCCESS PAGE: Updating transaction:', transaction.id);
        
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id);

        if (updateError) {
          console.error('❌ SUCCESS PAGE: Failed to update transaction:', transaction.id, updateError);
        } else {
          console.log('✅ SUCCESS PAGE: Successfully updated transaction:', transaction.id);
        }
      }
    } catch (error) {
      console.error('❌ SUCCESS PAGE: Manual transaction update failed:', error);
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
    
    console.log('💰 Parsed params:', { id, amount, currency, description, clientName, timestamp })

    if (id && amount && description && timestamp) {
      console.log('✅ All required params present - setting payment details')
      setPaymentDetails({
        id,
        amount: parseFloat(amount),
        currency,
        description,
        clientName: clientName || undefined,
        timestamp
      })
      
      // Manual transaction status update as fallback for webhook failures
      manualTransactionUpdate(id)
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