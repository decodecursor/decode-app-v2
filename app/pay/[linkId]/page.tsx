'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { CrossmintProvider, CrossmintEmbeddedCheckout } from '@crossmint/client-sdk-react-ui'

interface PaymentLinkData {
  id: string
  title: string
  amount_aed: number
  expiration_date: string
  is_active: boolean
  created_at: string
  creator: {
    full_name: string | null
    email: string
  }
}

export default function PaymentPage() {
  const [paymentData, setPaymentData] = useState<PaymentLinkData | null>(null)
  const [loading, setLoading] = useState(true)
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
    
    try {
      // Create transaction record
      const transactionData = {
        id: payment.id || 'embedded_' + Date.now(),
        payment_link_id: linkId,
        buyer_email: payment.buyerEmail || null,
        amount_aed: paymentData?.amount_aed,
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

      await supabase.from('transactions').insert([transactionData])
      
      // Redirect to success page
      const params = new URLSearchParams({
        id: transactionData.id,
        amount: paymentData?.amount_aed.toString() || '0',
        currency: 'AED',
        description: paymentData?.title || 'Payment',
        timestamp: new Date().toISOString()
      })
      
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
    const fetchPaymentLink = async () => {
      if (!linkId || !isValidUUID(linkId)) {
        setError('Invalid payment link')
        setErrorType('invalid')
        setLoading(false)
        return
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('payment_links')
          .select(`
            id,
            title,
            amount_aed,
            expiration_date,
            is_active,
            created_at,
            creator:creator_id (
              full_name,
              email
            )
          `)
          .eq('id', linkId)
          .single()

        if (fetchError || !data) {
          setError('Payment link not found')
          setErrorType('not-found')
          setLoading(false)
          return
        }

        if (!data.is_active) {
          setError('Payment link is deactivated')
          setErrorType('inactive')
          setLoading(false)
          return
        }

        const now = new Date()
        const expirationDate = new Date(data.expiration_date)
        if (now > expirationDate) {
          setError('Payment link expired')
          setErrorType('expired')
          setLoading(false)
          return
        }

        const transformedData: PaymentLinkData = {
          ...data,
          creator: Array.isArray(data.creator) ? data.creator[0] : data.creator
        }

        setPaymentData(transformedData)
      } catch (error) {
        console.error('Error fetching payment link:', error)
        setError('Unable to load payment information')
        setErrorType('network')
      } finally {
        setLoading(false)
      }
    }

    fetchPaymentLink()
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
              <p className="text-4xl font-bold text-gray-900">AED {paymentData.amount_aed.toFixed(2)}</p>
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
                  {paymentData.creator.full_name || paymentData.creator.email?.split('@')[0] || 'Unknown'}
                </p>
                <p className="text-gray-600 text-sm">{paymentData.creator.email}</p>
              </div>
            </div>
          </div>

          {/* EMBEDDED CROSSMINT CHECKOUT */}
          <div className="mt-8 border-t border-gray-200 pt-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Payment Options</h4>
            <CrossmintProvider apiKey={process.env.NEXT_PUBLIC_CROSSMINT_API_KEY || ''}>
              <CrossmintEmbeddedCheckout
                lineItems={{
                  collectionLocator: `crossmint:${process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID}:beauty-services`,
                  callData: {
                    totalPrice: paymentData.amount_aed.toFixed(2),
                    quantity: 1,
                    paymentLinkId: linkId,
                    beautyProfessionalId: paymentData.creator.email,
                    service: 'beauty',
                    title: paymentData.title
                  }
                }}
                payment={{
                  fiat: {
                    enabled: true,
                    allowedMethods: {
                      card: true,
                      applePay: true,
                      googlePay: true
                    },
                    defaultCurrency: 'AED'
                  },
                  defaultMethod: 'fiat'
                }}
                onEvent={{
                  'payment:process.succeeded': handlePaymentSuccess,
                  'payment:process.failed': handlePaymentFailure
                }}
              />
            </CrossmintProvider>
          </div>
        </div>
      </div>
    </div>
  )
}