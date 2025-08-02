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
  const manualTransactionUpdate = async (paymentLinkId: string, paymentIntentId?: string) => {
    try {
      console.log('🔄 SUCCESS PAGE: Attempting manual transaction status update');
      console.log('   - Payment Link ID:', paymentLinkId);
      console.log('   - Payment Intent ID:', paymentIntentId || 'not provided');
      
      // First, check if ANY transaction exists for this payment link
      const { data: existingTransactions, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('payment_link_id', paymentLinkId);

      if (fetchError) {
        console.error('❌ SUCCESS PAGE: Error fetching transactions:', fetchError);
        return;
      }

      console.log('🔍 SUCCESS PAGE: Total existing transactions:', existingTransactions?.length || 0);

      // If no transactions exist at all, create one
      if (!existingTransactions || existingTransactions.length === 0) {
        console.log('⚠️ SUCCESS PAGE: No transactions found - creating new completed transaction');
        
        // Get payment link details
        const { data: paymentLink, error: linkError } = await supabase
          .from('payment_links')
          .select('*')
          .eq('id', paymentLinkId)
          .single();
          
        if (linkError || !paymentLink) {
          console.error('❌ Cannot create transaction - payment link not found:', linkError);
          return;
        }
        
        // Create a completed transaction
        const newTransaction = {
          payment_link_id: paymentLinkId,
          amount_aed: paymentLink.amount_aed,
          status: 'completed',
          payment_processor: 'stripe',
          processor_transaction_id: paymentIntentId || `manual_${Date.now()}`,
          processor_payment_id: paymentIntentId || `manual_${Date.now()}`,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          metadata: {
            created_from: 'success_page_fallback',
            payment_intent: paymentIntentId,
            client_name: paymentLink.client_name,
            service_title: paymentLink.title
          }
        };
        
        const { data: createdTx, error: createError } = await supabase
          .from('transactions')
          .insert(newTransaction)
          .select()
          .single();
          
        if (createError) {
          console.error('❌ Failed to create transaction:', createError);
        } else {
          console.log('✅ Created new completed transaction:', createdTx.id);
        }
        return;
      }

      // Check if there are pending transactions to update
      const pendingTransactions = existingTransactions.filter(tx => tx.status === 'pending');
      console.log('🔍 SUCCESS PAGE: Pending transactions to update:', pendingTransactions.length);

      // Update pending transactions to completed
      for (const transaction of pendingTransactions) {
        console.log('🔄 SUCCESS PAGE: Updating transaction:', transaction.id);
        
        const updateData: any = {
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // If we have a payment intent ID and the transaction doesn't have one, add it
        if (paymentIntentId && !transaction.processor_transaction_id) {
          updateData.processor_transaction_id = paymentIntentId;
          updateData.processor_payment_id = paymentIntentId;
        }
        
        const { error: updateError } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('id', transaction.id);

        if (updateError) {
          console.error('❌ SUCCESS PAGE: Failed to update transaction:', transaction.id, updateError);
        } else {
          console.log('✅ SUCCESS PAGE: Successfully updated transaction:', transaction.id);
        }
      }
      
      // Log final status
      const completedCount = existingTransactions.filter(tx => tx.status === 'completed').length + pendingTransactions.length;
      console.log(`✅ SUCCESS PAGE: Payment complete - ${completedCount} completed transaction(s)`);
      
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
      
      // Manual transaction status update as fallback for webhook failures
      // Note: 'id' here is the payment_link_id, not transaction id
      // Pass the payment intent ID if available
      manualTransactionUpdate(id, paymentIntent || undefined)
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