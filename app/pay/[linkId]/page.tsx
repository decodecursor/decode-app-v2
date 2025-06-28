'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import { CrossmintPaymentButton, usePaymentValidation } from '@/components/crossmint'
import type { PaymentData } from '@/components/crossmint'
import { MobilePaymentSheet } from '@/components/mobile'

interface PaymentLinkData {
  id: string
  title: string
  amount_usd: number
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
  const [buyerEmail, setBuyerEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [showMobilePaymentSheet, setShowMobilePaymentSheet] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const params = useParams()
  const router = useRouter()
  const linkId = params.linkId as string

  const isValidUUID = (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  const isValidEmail = (email: string) => {
    if (!email.trim()) return true // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value
    setBuyerEmail(email)
    
    // Clear error when user starts typing
    if (emailError) {
      setEmailError('')
    }
  }

  const validateEmail = () => {
    if (buyerEmail.trim() && !isValidEmail(buyerEmail)) {
      setEmailError('Please enter a valid email address')
      return false
    }
    setEmailError('')
    return true
  }

  // Prepare payment data for Crossmint
  const crossmintPaymentData: PaymentData = {
    amount: paymentData?.amount_usd || 0,
    currency: 'USD',
    description: paymentData?.title || 'Beauty Service Payment',
    buyerEmail: buyerEmail.trim() || undefined,
    metadata: {
      paymentLinkId: linkId,
      creatorId: paymentData?.creator?.email,
      timestamp: new Date().toISOString()
    }
  }

  // Use payment validation hook
  const { isValid: isPaymentValid, errors: paymentErrors } = usePaymentValidation(crossmintPaymentData)

  const handlePaymentSuccess = async (payment: { id?: string; [key: string]: unknown }) => {
    console.log('✅ Payment successful:', payment)
    
    const paymentDetails = {
      id: payment.id || 'dev_payment_' + Date.now(),
      amount: crossmintPaymentData.amount,
      currency: crossmintPaymentData.currency,
      description: crossmintPaymentData.description,
      buyerEmail: crossmintPaymentData.buyerEmail,
      timestamp: new Date().toISOString()
    }

    try {
      // Create transaction record in Supabase
      await createTransaction(payment)
      
      // Redirect to success page with payment details
      const params = new URLSearchParams({
        id: paymentDetails.id,
        amount: paymentDetails.amount.toString(),
        currency: paymentDetails.currency,
        description: paymentDetails.description,
        timestamp: paymentDetails.timestamp,
        ...(paymentDetails.buyerEmail && { buyerEmail: paymentDetails.buyerEmail }),
        ...(payment.id && { transactionId: payment.id.toString() })
      })
      
      router.push(`/pay/success?${params.toString()}`)
    } catch (error) {
      console.error('Failed to create transaction record:', error)
      // Still redirect to success but without transaction record
      const params = new URLSearchParams({
        id: paymentDetails.id,
        amount: paymentDetails.amount.toString(),
        currency: paymentDetails.currency,
        description: paymentDetails.description,
        timestamp: paymentDetails.timestamp,
        ...(paymentDetails.buyerEmail && { buyerEmail: paymentDetails.buyerEmail })
      })
      
      router.push(`/pay/success?${params.toString()}`)
    }
  }

  const handlePaymentFailure = (error: { message?: string; [key: string]: unknown }) => {
    console.error('❌ Payment failed:', error)
    
    // Redirect to failure page with error details
    const params = new URLSearchParams({
      error: error?.message || 'Payment processing failed. Please try again.',
      linkId: linkId,
      ...(paymentData && {
        amount: paymentData.amount_usd.toString(),
        currency: 'USD',
        description: paymentData.title
      }),
      timestamp: new Date().toISOString()
    })
    
    router.push(`/pay/failed?${params.toString()}`)
  }

  const handlePaymentPending = (payment?: { id?: string; [key: string]: unknown }) => {
    console.log('⏳ Payment pending...', payment)
    
    // Redirect to pending page with payment details
    const params = new URLSearchParams({
      id: payment?.id?.toString() || 'pending_' + Date.now(),
      amount: crossmintPaymentData.amount.toString(),
      currency: crossmintPaymentData.currency,
      description: crossmintPaymentData.description,
      timestamp: new Date().toISOString(),
      linkId: linkId,
      ...(crossmintPaymentData.buyerEmail && { buyerEmail: crossmintPaymentData.buyerEmail })
    })
    
    router.push(`/pay/pending?${params.toString()}`)
  }

  const createTransaction = async (payment: { id?: string; [key: string]: unknown }) => {
    if (!paymentData) return

    const transactionData = {
      id: payment.id || 'dev_' + Date.now(),
      payment_link_id: linkId,
      buyer_email: buyerEmail.trim() || null,
      amount_usd: paymentData.amount_usd,
      status: 'completed',
      payment_processor: 'crossmint',
      processor_transaction_id: payment.id || null,
      metadata: {
        serviceTitle: paymentData.title,
        creatorEmail: paymentData.creator.email,
        paymentTimestamp: new Date().toISOString(),
        processorData: payment
      }
    }

    const { error } = await supabase
      .from('transactions')
      .insert([transactionData])

    if (error) {
      console.error('Error creating transaction:', error)
      throw error
    }

    console.log('✅ Transaction record created successfully')
  }

  // Mobile detection effect
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const fetchPaymentLink = async () => {
      // Validate linkId exists and is a valid UUID
      if (!linkId) {
        setError('Invalid payment link URL')
        setErrorType('invalid')
        setLoading(false)
        return
      }

      if (!isValidUUID(linkId)) {
        setError('Invalid payment link format')
        setErrorType('invalid')
        setLoading(false)
        return
      }

      try {
        // Fetch payment link with creator information
        const { data, error: fetchError } = await supabase
          .from('payment_links')
          .select(`
            id,
            title,
            amount_usd,
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

        if (fetchError) {
          // Handle specific Supabase errors
          if (fetchError.code === 'PGRST116') {
            // No rows returned
            setError('Payment link not found')
            setErrorType('not-found')
          } else {
            throw fetchError
          }
          setLoading(false)
          return
        }

        if (!data) {
          setError('Payment link not found')
          setErrorType('not-found')
          setLoading(false)
          return
        }

        // Check if creator data exists
        if (!data.creator || (Array.isArray(data.creator) && data.creator.length === 0)) {
          setError('Payment link creator information is unavailable')
          setErrorType('creator-missing')
          setLoading(false)
          return
        }

        // Validate link is active (check this before expiration)
        if (!data.is_active) {
          setError('This payment link has been deactivated by the service provider')
          setErrorType('inactive')
          setLoading(false)
          return
        }

        // Validate link is not expired
        const now = new Date()
        const expirationDate = new Date(data.expiration_date)
        
        // Add some buffer time validation
        if (isNaN(expirationDate.getTime())) {
          setError('Payment link has invalid expiration data')
          setErrorType('invalid')
          setLoading(false)
          return
        }

        if (now > expirationDate) {
          setError('This payment link expired on ' + expirationDate.toLocaleDateString())
          setErrorType('expired')
          setLoading(false)
          return
        }

        // Additional validation for amount
        if (!data.amount_usd || data.amount_usd <= 0) {
          setError('Payment link has invalid amount')
          setErrorType('invalid')
          setLoading(false)
          return
        }

        // Transform the data to match our interface
        const transformedData: PaymentLinkData = {
          ...data,
          creator: Array.isArray(data.creator) ? (data.creator[0] || { full_name: null, email: '' }) : (data.creator || { full_name: null, email: '' })
        }

        setPaymentData(transformedData)
      } catch (error) {
        console.error('Error fetching payment link:', error)
        setError('Unable to load payment information. Please try again later.')
        setErrorType('network')
      } finally {
        setLoading(false)
      }
    }

    fetchPaymentLink()
  }, [linkId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getErrorIcon = () => {
    switch (errorType) {
      case 'not-found':
        return (
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )
      case 'expired':
        return (
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'inactive':
        return (
          <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
        )
      case 'network':
        return (
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )
      default:
        return (
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )
    }
  }

  const getErrorTitle = () => {
    switch (errorType) {
      case 'not-found':
        return 'Payment Link Not Found'
      case 'expired':
        return 'Payment Link Expired'
      case 'inactive':
        return 'Payment Link Deactivated'
      case 'invalid':
        return 'Invalid Payment Link'
      case 'creator-missing':
        return 'Service Provider Information Unavailable'
      case 'network':
        return 'Connection Error'
      default:
        return 'Payment Link Unavailable'
    }
  }

  const getErrorSubtitle = () => {
    switch (errorType) {
      case 'not-found':
        return 'The payment link you\'re looking for doesn\'t exist or may have been removed.'
      case 'expired':
        return 'This payment link is no longer accepting payments.'
      case 'inactive':
        return 'The service provider has temporarily disabled this payment link.'
      case 'invalid':
        return 'The payment link format is invalid or contains errors.'
      case 'creator-missing':
        return 'We\'re unable to process this payment due to missing provider information.'
      case 'network':
        return 'We\'re having trouble connecting to our servers. Please try again in a moment.'
      default:
        return 'This payment link is currently unavailable.'
    }
  }

  const getErrorBackground = () => {
    switch (errorType) {
      case 'expired':
        return 'bg-yellow-100'
      case 'inactive':
        return 'bg-orange-100'
      case 'not-found':
        return 'bg-gray-100'
      default:
        return 'bg-red-100'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium text-sm sm:text-base">Loading payment information...</p>
        </div>
      </div>
    )
  }

  if (error || !paymentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center">
          <div className={`w-12 h-12 sm:w-16 sm:h-16 ${getErrorBackground()} rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6`}>
            {getErrorIcon()}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">{getErrorTitle()}</h1>
          <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">{error}</p>
          <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">{getErrorSubtitle()}</p>
          
          {/* Different action suggestions based on error type */}
          <div className="border-t border-gray-200 pt-6">
            {errorType === 'network' ? (
              <button 
                onClick={() => window.location.reload()} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
            ) : errorType === 'expired' || errorType === 'inactive' ? (
              <div className="text-sm text-gray-500">
                <p className="mb-2">This payment link is no longer available.</p>
                <p>Please contact the service provider for a new payment link.</p>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                <p className="mb-2">Please verify the payment link URL is correct.</p>
                <p>If you continue to have issues, contact the service provider for assistance.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-lg w-full mx-auto">
        {/* Mobile viewport meta is handled in layout.tsx */}
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m8 0h2" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">DECODE</h1>
          <p className="text-sm sm:text-base text-gray-600">Beauty Payment Platform</p>
        </div>

        {/* Service Information */}
        <div className="border-t border-gray-200 pt-6 sm:pt-8">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Service Details</h2>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 leading-tight">{paymentData.title}</h3>
          </div>

          {/* Amount */}
          <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm font-medium mb-2">Total Amount</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">${paymentData.amount_usd.toFixed(2)}</p>
              <p className="text-gray-500 text-sm mt-2">USD</p>
            </div>
          </div>

          {/* Professional Information */}
          <div className="mb-4 sm:mb-6">
            <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Beauty Professional</h4>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                  {paymentData.creator.full_name || paymentData.creator.email?.split('@')[0] || 'Unknown'}
                </p>
                <p className="text-gray-600 text-xs sm:text-sm truncate">{paymentData.creator.email}</p>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
              <span>Created</span>
              <span>{formatDate(paymentData.created_at)}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>Expires</span>
              <span>{formatDate(paymentData.expiration_date)}</span>
            </div>
          </div>

          {/* Buyer Information Form */}
          <div className="border-t border-gray-200 pt-6 sm:pt-8 mt-6 sm:mt-8">
            <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Contact Information</h4>
            <p className="text-gray-600 text-sm mb-4">
              Email address is optional but recommended for payment confirmation and receipt.
            </p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="buyerEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  id="buyerEmail"
                  value={buyerEmail}
                  onChange={handleEmailChange}
                  onBlur={validateEmail}
                  placeholder="your@email.com"
                  className={`w-full px-4 py-3 sm:py-3 border rounded-xl font-medium transition-colors text-base ${
                    emailError 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                      : 'border-gray-300 focus:border-purple-500 focus:ring-purple-200'
                  } focus:outline-none focus:ring-2`}
                  style={{ fontSize: '16px' }} // Prevent zoom on iOS
                />
                {emailError && (
                  <p className="mt-2 text-sm text-red-600">{emailError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Payment Validation Errors */}
          {!isPaymentValid && paymentErrors.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <h4 className="text-red-800 font-semibold mb-2">Please fix the following issues:</h4>
              <ul className="list-disc list-inside text-sm text-red-700">
                {paymentErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Payment Button */}
          <div className="mt-6 sm:mt-8">
            {isMobile ? (
              <>
                <button
                  onClick={() => setShowMobilePaymentSheet(true)}
                  disabled={!!emailError || !isPaymentValid}
                  className="w-full min-h-[50px] sm:min-h-[56px] text-base sm:text-lg font-semibold bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                >
                  Pay ${paymentData?.amount_usd.toFixed(2)} USD
                </button>
                <p className="text-center text-gray-500 text-xs sm:text-sm mt-3 px-2">
                  Secure payment processing with Crossmint • Your information is protected
                </p>
              </>
            ) : (
              <>
                <CrossmintPaymentButton
                  paymentData={crossmintPaymentData}
                  onSuccess={handlePaymentSuccess}
                  onFailure={handlePaymentFailure}
                  onPending={handlePaymentPending}
                  disabled={!!emailError || !isPaymentValid}
                  buttonText={`Pay $${paymentData?.amount_usd.toFixed(2)} USD`}
                  size="lg"
                  className="w-full min-h-[50px] sm:min-h-[56px] text-base sm:text-lg font-semibold"
                />
                <p className="text-center text-gray-500 text-xs sm:text-sm mt-3 px-2">
                  Secure payment processing with Crossmint • Your information is protected
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Payment Sheet */}
      {paymentData && (
        <MobilePaymentSheet
          isOpen={showMobilePaymentSheet}
          onClose={() => setShowMobilePaymentSheet(false)}
          paymentData={crossmintPaymentData}
          onSuccess={handlePaymentSuccess}
          onFailure={handlePaymentFailure}
          onPending={handlePaymentPending}
          serviceTitle={paymentData.title}
          creatorName={paymentData.creator.full_name || paymentData.creator.email?.split('@')[0] || 'Unknown'}
          disabled={!!emailError || !isPaymentValid}
        />
      )}
    </div>
  )
}