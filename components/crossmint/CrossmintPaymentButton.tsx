'use client'

import React from 'react'
import { CrossmintPayButton } from '@crossmint/client-sdk-react-ui'

interface PaymentData {
  amount: number
  currency: string
  description: string
  buyerEmail?: string
  metadata?: Record<string, any>
}

interface CrossmintPaymentButtonProps {
  paymentData: PaymentData
  onSuccess?: (payment: any) => void
  onFailure?: (error: any) => void
  onPending?: () => void
  disabled?: boolean
  className?: string
  buttonText?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary'
}

export function CrossmintPaymentButton({
  paymentData,
  onSuccess,
  onFailure,
  onPending,
  disabled = false,
  className = '',
  buttonText = 'Pay with Crossmint',
  size = 'md',
  variant = 'primary'
}: CrossmintPaymentButtonProps) {
  
  // IMMEDIATE DEBUG - this should ALWAYS show in console
  console.log('🚨 CROSSMINT COMPONENT LOADED - NEW VERSION');
  
  const handlePaymentSuccess = (payment: any) => {
    console.log('✅ Payment successful:', payment)
    onSuccess?.(payment)
  }

  const handlePaymentFailure = (error: any) => {
    console.error('❌ Payment failed:', error)
    onFailure?.(error)
  }

  const handlePaymentPending = () => {
    console.log('⏳ Payment pending...')
    onPending?.()
  }

  // Size styling
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  }

  // Variant styling
  const variantClasses = {
    primary: 'bg-purple-600 hover:bg-purple-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900'
  }

  // Get Crossmint project ID and API key from environment
  const projectId = process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID || '10630979-cdbd-453e-8b49-cdca01318624'
  const apiKey = process.env.NEXT_PUBLIC_CROSSMINT_API_KEY || 'ck_production_5P1d43U3e6VM5NVhDXBNj5j9HTXF1fuETZQHH7bRJ1nAYS54vjCQ4id2d4e7zuSkM9mG7tw72wbJDWet6nRtz6VH5tsT4xNPBjvwBnDGcbbynJu8NagXHfShpBuXGALteaCB1v4M2x5hi2kYG27BYHoeCeNWRwgKGQXYsvMDN9GU947jq2uzU77cAS3GDs7YioPPwTWgvTo2PVorf1gSYu6g'
  
  // Debug logging for production troubleshooting
  console.log('🔧 DEBUG: Crossmint configuration check:', {
    projectIdEnv: process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID,
    apiKeyEnv: process.env.NEXT_PUBLIC_CROSSMINT_API_KEY,
    projectId: projectId,
    apiKey: apiKey ? `${apiKey.substring(0, 20)}...` : 'MISSING',
    isProduction: process.env.NODE_ENV === 'production'
  })
  
  // SIMPLE DEBUG LOGS
  console.log('PROJECT ID ENV VAR:', process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID)
  console.log('API KEY ENV VAR:', process.env.NEXT_PUBLIC_CROSSMINT_API_KEY ? `${process.env.NEXT_PUBLIC_CROSSMINT_API_KEY.substring(0, 20)}...` : 'MISSING')
  console.log('PROJECT ID BEING USED:', projectId)
  console.log('API KEY BEING USED:', apiKey ? `${apiKey.substring(0, 20)}...` : 'MISSING')
  console.log('ABOUT TO RENDER CrossmintPayButton with projectId and apiKey')
  
  if (!projectId || projectId === 'demo-project-staging') {
    console.error('NEXT_PUBLIC_CROSSMINT_PROJECT_ID not configured properly')
    return (
      <div className="text-red-500 text-sm p-3 border border-red-300 rounded">
        Crossmint project ID not configured. Please check environment variables.
      </div>
    )
  }
  
  if (!apiKey || apiKey.length < 10) {
    console.error('NEXT_PUBLIC_CROSSMINT_API_KEY not configured properly')
    return (
      <div className="text-red-500 text-sm p-3 border border-red-300 rounded">
        Crossmint API key not configured. Please check environment variables.
      </div>
    )
  }

  return (
    <CrossmintPayButton
      projectId={projectId}
      clientId={apiKey}
      environment={process.env.CROSSMINT_ENVIRONMENT || 'production'}
      mintConfig={{
        type: 'erc-20',
        totalPrice: paymentData.amount.toString(),
        quantity: 1,
        currency: paymentData.currency,
        metadata: {
          description: paymentData.description,
          buyerEmail: paymentData.buyerEmail,
          ...paymentData.metadata
        }
      }}
      onEvent={{
        'payment:process.succeeded': handlePaymentSuccess,
        'payment:process.failed': handlePaymentFailure,
        'payment:process.pending': handlePaymentPending
      }}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}
        ${className}
        font-semibold rounded-xl transition-all duration-200 
        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
        disabled:hover:bg-purple-600
      `}
    >
      {buttonText}
    </CrossmintPayButton>
  )
}

// Hook for payment validation
export function usePaymentValidation(paymentData: PaymentData) {
  const isValid = React.useMemo(() => {
    if (!paymentData.amount || paymentData.amount <= 0) return false
    if (!paymentData.currency) return false
    if (!paymentData.description?.trim()) return false
    
    // Email validation if provided
    if (paymentData.buyerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(paymentData.buyerEmail)) return false
    }
    
    return true
  }, [paymentData])

  const errors = React.useMemo(() => {
    const errorList: string[] = []
    
    if (!paymentData.amount || paymentData.amount <= 0) {
      errorList.push('Amount must be greater than 0')
    }
    if (!paymentData.currency) {
      errorList.push('Currency is required')
    }
    if (!paymentData.description?.trim()) {
      errorList.push('Description is required')
    }
    if (paymentData.buyerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(paymentData.buyerEmail)) {
        errorList.push('Invalid email format')
      }
    }
    
    return errorList
  }, [paymentData])

  return { isValid, errors }
}

export type { PaymentData, CrossmintPaymentButtonProps }