'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CustomPaymentForm from '@/components/payment/CustomPaymentForm'
import { CrossmintPaymentElement } from '@crossmint/client-sdk-react-ui'

interface PaymentLinkData {
  id: string
  title: string
  amount_aed: number
  total_amount_aed: number
  client_name: string | null
  expiration_date: string
  is_active: boolean
  created_at: string
  isPaid?: boolean
  creator: {
    id: string
    name: string
    professionalCenter?: string
  }
}

export default function PaymentPage() {
  const [mounted, setMounted] = useState(false)
  const [paymentData, setPaymentData] = useState<PaymentLinkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'crossmint'>('stripe')
  
  const params = useParams()
  const router = useRouter()
  const linkId = params.linkId as string

  // Format amount with thousands separators
  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchPaymentData = async () => {
      if (!linkId) {
        setError('Invalid payment link')
        setLoading(false)
        return
      }

      try {
        console.log('🔍 Fetching payment link via API:', linkId)
        
        const response = await fetch(`/api/payment/create-link?linkId=${linkId}`, {
          method: 'GET'
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          console.error('❌ API error:', errorData)
          throw new Error(errorData.error || 'Failed to fetch payment link')
        }

        const result = await response.json()
        console.log('🔍 API result:', result)
        
        if (!result.success || !result.data) {
          throw new Error('Invalid API response')
        }

        const data = result.data.paymentLink
        const creator = result.data.creator

        if (!data) {
          setError('Payment link not found')
          return
        }

        if (!data.is_active) {
          setError('Payment link is deactivated')
          return
        }

        const now = new Date()
        const expirationDate = new Date(data.expiration_date)
        if (now > expirationDate) {
          setError('Payment link expired')
          return
        }

        const transformedData: PaymentLinkData = {
          ...data,
          isPaid: data.is_paid || false,
          creator: { 
            id: creator.id, 
            name: creator.name, 
            professionalCenter: creator.professionalCenter 
          }
        }

        setPaymentData(transformedData)
        console.log('✅ Payment data loaded successfully')
        
      } catch (error) {
        console.error('❌ Payment page error:', error)
        setError('Unable to load payment information')
      } finally {
        setLoading(false)
      }
    }

    if (mounted && linkId) {
      fetchPaymentData()
    }
  }, [linkId, mounted])

  if (!mounted) {
    return null // Prevent SSR hydration issues
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment information...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error || (!loading && !paymentData)) {
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

  // Show payment interface
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
            <h3 className="text-2xl font-bold text-gray-800 mb-4">{paymentData?.title}</h3>
          </div>

          {/* Amount - Show TOTAL amount to customers */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm font-medium mb-2">Total Amount</p>
              <p className="text-4xl font-bold text-gray-900">
                AED {formatAmount(paymentData?.total_amount_aed || paymentData?.amount_aed || 0)}
              </p>
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
                  {paymentData?.creator?.name || 'Beauty Professional'}
                </p>
                <p className="text-gray-600 text-sm">
                  {paymentData?.creator?.professionalCenter || 'Beauty Professional'}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Options */}
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
                  💳 Card Payment
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

            {/* Payment Forms */}
            {paymentMethod === 'stripe' && paymentData && (
              <CustomPaymentForm
                paymentLinkId={linkId}
                amount={paymentData.total_amount_aed || paymentData.amount_aed}
                currency="AED"
                description={paymentData.title}
                beautyProfessionalName={paymentData.creator?.name || 'Beauty Professional'}
                customerName={paymentData.client_name || undefined}
                onSuccess={() => {
                  console.log('💳 Stripe payment success callback triggered');
                }}
                onError={(error: any) => {
                  console.error('Payment error:', error);
                }}
              />
            )}

            {paymentMethod === 'crossmint' && paymentData && (
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
                    beautyProfessionalId: paymentData.creator?.id || '',
                    service: 'beauty',
                    title: paymentData.title,
                    originalAmount: paymentData.total_amount_aed || paymentData.amount_aed,
                    originalCurrency: 'AED'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}