'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CustomPaymentForm from '@/components/payment/CustomPaymentForm'
import { getBusinessDisplayName } from '@/lib/user-display'

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
    user_name: string | null
    email: string
    company_name: string | null
  }
}

export default function PaymentPageClient() {
  const [paymentData, setPaymentData] = useState<PaymentLinkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
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
            user_name: creator.name, 
            email: creator.email || 'creator@example.com',
            company_name: creator.professionalCenter 
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

    if (linkId) {
      fetchPaymentData()
    }
  }, [linkId])

  // Show loading state
  if (loading) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="cosmic-card max-w-md w-full text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-4"></div>
            <p className="cosmic-body text-white opacity-80">Loading payment information...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error || (!loading && !paymentData)) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="cosmic-card max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="cosmic-logo text-red-400 mb-4">Payment Link Error</h1>
            <p className="cosmic-body text-white opacity-80">{error}</p>
          </div>
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
              <div className="relative w-14 h-14 mx-auto mb-4">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-pulse"></div>
                <div className="relative w-14 h-14 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h1 className="cosmic-logo text-blue-400 mb-2">Payment Completed</h1>
              <p className="cosmic-body opacity-70 mb-4">This payment link has already been paid</p>
            </div>

            {/* Payment Details */}
            <div className="bg-black rounded-lg p-6 mb-6">
              <p className="cosmic-body text-white mb-2">{paymentData.title}</p>
              <p className="cosmic-body text-white">
                {paymentData.client_name || 'Client Name'}
              </p>
              <p className="cosmic-body text-white mt-2">
                Service by {getBusinessDisplayName(paymentData.creator)}
              </p>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Show the beautiful cosmic CustomPaymentForm - this is what you see in the screenshot!
  if (paymentData) {
    return (
      <CustomPaymentForm
        paymentLinkId={linkId}
        amount={paymentData.total_amount_aed || paymentData.amount_aed}
        currency="AED"
        description={paymentData.title}
        beautyProfessionalName={getBusinessDisplayName(paymentData.creator)}
        customerName={paymentData.client_name || undefined}
        onSuccess={() => {
          console.log('💳 Payment success callback triggered');
        }}
        onError={(error: any) => {
          console.error('Payment error:', error);
        }}
      />
    );
  }

  return null;
}