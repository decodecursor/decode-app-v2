'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getUserDisplayName, getBusinessDisplayName } from '@/lib/user-display'
import { useParams, useRouter } from 'next/navigation'
import { CrossmintPaymentElement } from '@crossmint/client-sdk-react-ui'
import { walletCreationService } from '@/lib/wallet-creation'
import StripeCheckoutButton from '@/components/payment/StripeCheckoutButton'
import CustomPaymentForm from '@/components/payment/CustomPaymentForm'

interface PaymentLinkData {
  id: string
  title: string
  amount_aed: number
  client_name: string | null
  expiration_date: string
  is_active: boolean
  created_at: string
  payment_status: 'unpaid' | 'paid' | 'failed' | 'refunded'
  paid_at: string | null
  isPaid?: boolean
  creator: {
    id: string
    full_name: string | null
    email: string
    company_name: string | null
  }
}

export default function PaymentPage() {
  const [paymentData, setPaymentData] = useState<PaymentLinkData | null>(null)
  const [crossmintOrder, setCrossmintOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'crossmint'>('stripe')

  // Format amount with thousands separators
  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }
  const [error, setError] = useState('')
  const [errorType, setErrorType] = useState<'not-found' | 'inactive' | 'expired' | 'invalid' | 'network' | 'creator-missing'>('not-found')
  const params = useParams()
  const router = useRouter()
  const linkId = params.linkId as string

  const isValidUUID = (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  const handlePaymentSuccess = async (payment: any) => {
    console.log('✅ Payment successful:', payment)
    console.log('💳 Payment data available:', paymentData)
    
    try {
      // Create transaction record
      const transactionData = {
        id: payment.id || 'embedded_' + Date.now(),
        payment_link_id: linkId,
        buyer_email: payment.buyerEmail || null,
        amount_aed: paymentData?.amount_aed || 0,
        status: 'completed',
        payment_processor: 'crossmint',
        processor_transaction_id: payment.id || null,
        metadata: {
          serviceTitle: paymentData?.title,
          creatorEmail: paymentData?.creator.email,
          paymentTimestamp: new Date().toISOString(),
          processorData: payment
        }
      }

      await supabase.from('transactions').insert(transactionData)
      
      // 🔑 WALLET CREATION FOR BUYER
      if (payment.buyerEmail) {
        console.log('🔄 Creating wallet for buyer:', payment.buyerEmail)
        
        try {
          // Check if user exists, create if not
          let { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', payment.buyerEmail)
            .single()
          
          if (userError || !user) {
            console.log('👤 Creating new user for buyer:', payment.buyerEmail)
            const { data: newUser, error: createError } = await supabase
              .from('users')
              .insert({
                email: payment.buyerEmail,
                full_name: payment.buyerEmail.split('@')[0],
                role: 'Beauty Model', // Default role for buyers
                created_at: new Date().toISOString()
              })
              .select('id')
              .single()
            
            if (createError) {
              console.error('Failed to create user:', createError)
            } else {
              user = newUser
            }
          }
          
          // Create wallet for the user
          if (user) {
            const walletResult = await walletCreationService.createWalletForUser(
              user.id,
              payment.buyerEmail
            )
            
            if (walletResult.success) {
              console.log('✅ Wallet created for buyer:', walletResult.walletAddress)
              
              // Update transaction with wallet info
              await supabase
                .from('transactions')
                .update({
                  metadata: {
                    ...transactionData.metadata,
                    buyerWalletAddress: walletResult.walletAddress,
                    buyerWalletId: walletResult.walletId
                  }
                })
                .eq('id', transactionData.id)
            } else {
              console.error('Failed to create wallet for buyer:', walletResult.error)
            }
          }
        } catch (walletError) {
          console.error('Wallet creation process failed:', walletError)
          // Don't fail the payment for wallet creation issues
        }
      }
      
      // Redirect to success page
      const params = new URLSearchParams({
        id: transactionData.id,
        amount: paymentData?.amount_aed.toString() || '0',
        currency: 'AED',
        description: paymentData?.title || 'Payment',
        timestamp: new Date().toISOString()
      })
      
      console.log('🚀 Redirecting to success page with params:', params.toString())
      console.log('🔗 Full success URL:', `/pay/success?${params.toString()}`)
      
      router.push(`/pay/success?${params.toString()}`)
    } catch (error) {
      console.error('Failed to create transaction record:', error)
      // Still redirect to success
      router.push(`/pay/success`)
    }
  }

  const handlePaymentFailure = (error: any) => {
    console.error('❌ Payment failed:', error)
    router.push(`/pay/failed?error=${encodeURIComponent(error?.message || 'Payment failed')}`)
  }

  useEffect(() => {
    const fetchPaymentData = async () => {
      if (!linkId || !isValidUUID(linkId)) {
        setError('Invalid payment link')
        setErrorType('invalid')
        setLoading(false)
        return
      }

      // Go directly to payment data loading - skip server-side order creation
      await fetchPaymentLinkDirect()
    }

    // Fallback function for direct Supabase query
    const fetchPaymentLinkDirect = async () => {
      try {
        console.log('🔍 DEBUG: Direct Supabase query for linkId:', linkId)
        
        const { data, error: fetchError } = await supabase
          .from('payment_links')
          .select(`
            id,
            title,
            amount_aed,
            client_name,
            expiration_date,
            is_active,
            created_at,
            description,
            payment_status,
            paid_at,
            creator_id
          `)
          .eq('id', linkId)
          .single()

        console.log('🔍 DEBUG: Direct query result:', { data, error: fetchError })

        if (fetchError) {
          console.error('❌ DEBUG: Supabase query failed:', {
            error: fetchError,
            code: fetchError?.code,
            message: fetchError?.message,
            details: fetchError?.details,
            hint: fetchError?.hint,
            status: fetchError?.status
          })
          setError(`Payment link error: ${fetchError.message || 'Failed to load'}`)
          setErrorType('not-found')
          return
        }

        if (!data) {
          console.error('❌ DEBUG: No data returned from query')
          setError('Payment link not found')
          setErrorType('not-found')
          return
        }

        if (!data.is_active) {
          setError('Payment link is deactivated')
          setErrorType('inactive')
          return
        }

        const now = new Date()
        const expirationDate = new Date(data.expiration_date)
        if (now > expirationDate) {
          setError('Payment link expired')
          setErrorType('expired')
          return
        }

        // Check payment status using the payment_status field
        let isPaid = data.payment_status === 'paid'
        console.log('💰 Payment status check:')
        console.log('- payment_status:', data.payment_status)
        console.log('- is_active:', data.is_active)
        console.log('- isPaid:', isPaid)
        console.log('- paid_at:', data.paid_at)
        
        // CRITICAL: Fallback check - verify with transactions table
        // This handles cases where webhooks failed to update payment_status
        if (!isPaid) {
          console.log('🔍 Checking transactions table for completed payments...')
          const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('id, status, completed_at')
            .eq('payment_link_id', linkId)
            .eq('status', 'completed')
            .limit(1)
          
          if (!txError && transactions && transactions.length > 0) {
            console.log('✅ Found completed transaction - marking as paid')
            isPaid = true
            
            // Update the payment link status (self-healing)
            await supabase
              .from('payment_links')
              .update({ 
                payment_status: 'paid',
                paid_at: transactions[0]?.completed_at || new Date().toISOString()
              })
              .eq('id', linkId)
          }
        }

        const transformedData: PaymentLinkData = {
          ...data,
          isPaid,
          payment_status: data.payment_status || 'unpaid',
          paid_at: data.paid_at,
          creator: { 
            id: data.creator_id || '', 
            full_name: 'Beauty Professional', 
            email: '', 
            company_name: null 
          }
        }

        setPaymentData(transformedData)
        
        console.log('✅ DEBUG: Payment data loaded successfully')
      } catch (fallbackError) {
        console.error('❌ DEBUG: Fallback also failed:', fallbackError)
        setError('Unable to load payment information')
        setErrorType('network')
      } finally {
        setLoading(false)
      }
    }

    fetchPaymentData()
  }, [linkId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading payment...</p>
        </div>
      </div>
    )
  }

  if (error || !paymentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Payment Link Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  // If payment link has already been paid, show completion message
  if (paymentData && paymentData.isPaid) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card max-w-lg w-full text-center">
            {/* Already Paid Animation */}
            <div className="mb-8">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-pulse"></div>
                <div className="relative w-20 h-20 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h1 className="cosmic-logo text-blue-400 mb-2">Payment Completed</h1>
              <p className="cosmic-body opacity-70 mb-4">This payment link has already been completed by another person</p>
            </div>

            {/* Payment Details */}
            <div className="bg-white/10 rounded-lg p-6 backdrop-blur-sm mb-6">
              <h3 className="cosmic-body font-medium text-white mb-2">{paymentData.title}</h3>
              <p className="cosmic-body text-blue-400 font-bold text-xl">
                AED {formatAmount(paymentData.amount_aed)}
              </p>
              <p className="cosmic-body opacity-70 text-sm mt-2">
                Service by {getBusinessDisplayName(paymentData.creator)}
              </p>
            </div>

            {/* Info Message */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="cosmic-body text-blue-300 font-medium">Payment Link Used</p>
                  <p className="cosmic-body opacity-70 text-sm mt-1">
                    This payment link can only be used once and has been completed successfully.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If Stripe payment method is selected, show the custom payment form
  if (paymentMethod === 'stripe' && paymentData) {
    return (
      <CustomPaymentForm
        paymentLinkId={linkId}
        amount={paymentData.amount_aed}
        currency="AED"
        description={paymentData.title}
        beautyProfessionalName={getBusinessDisplayName(paymentData.creator)}
        customerName={paymentData.client_name || undefined}
        onSuccess={() => {
          console.log('💳 Stripe payment success callback triggered');
        }}
        onError={(error) => {
          console.error('Payment error:', error);
        }}
      />
    );
  }

  // Original design for Crossmint and selection
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m8 0h2" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">DECODE</h1>
          <p className="text-gray-600">Beauty Payment Platform</p>
        </div>

        {/* Service Information */}
        <div className="border-t border-gray-200 pt-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Service Details</h2>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">{paymentData.title}</h3>
          </div>

          {/* Amount */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm font-medium mb-2">Total Amount</p>
              <p className="text-4xl font-bold text-gray-900">AED {formatAmount(paymentData.amount_aed)}</p>
            </div>
          </div>

          {/* Professional Information */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Beauty Professional</h4>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {getBusinessDisplayName(paymentData.creator)}
                </p>
                <p className="text-gray-600 text-sm">
                  Beauty Professional
                </p>
              </div>
            </div>
          </div>

          {/* PAYMENT OPTIONS */}
          <div className="mt-8 border-t border-gray-200 pt-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Payment Options</h4>
            
            {/* Payment Method Selector */}
            <div className="mb-6">
              <div className="flex rounded-lg border border-gray-300 p-1 bg-gray-50">
                <button
                  onClick={() => setPaymentMethod('stripe')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    paymentMethod === 'stripe'
                      ? 'bg-white text-purple-700 shadow-sm border border-purple-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  💳 Payment
                </button>
                <button
                  onClick={() => setPaymentMethod('crossmint')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    paymentMethod === 'crossmint'
                      ? 'bg-white text-purple-700 shadow-sm border border-purple-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🔗 Alternative Payment
                </button>
              </div>
            </div>

            {paymentData && paymentMethod === 'crossmint' && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-2">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h5 className="font-medium text-green-900">Alternative Payment Methods</h5>
                  </div>
                  <p className="text-sm text-green-700">
                    Multiple payment options including cryptocurrency wallets and other methods.
                  </p>
                </div>

                <CrossmintPaymentElement
                  clientId={process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID!}
                  environment="production"
                  currency="USD"
                  locale="en-US"
                  paymentMethod="fiat"
                  uiConfig={{
                    colors: {
                      accent: '#7C3AED',
                      background: '#FFFFFF',
                      textPrimary: '#111827'
                    }
                  }}
                  whPassThroughArgs={{
                    paymentLinkId: linkId,
                    beautyProfessionalId: paymentData.creator.email,
                    service: 'beauty',
                    title: paymentData.title,
                    originalAmount: paymentData.amount_aed,
                    originalCurrency: 'AED'
                  }}
                />
              </div>
            )}

            {!paymentData && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading payment options...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}