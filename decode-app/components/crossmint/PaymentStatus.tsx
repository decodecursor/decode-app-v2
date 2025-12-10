'use client'

import React from 'react'

export type PaymentStatusType = 'idle' | 'pending' | 'success' | 'error'

interface PaymentDetails {
  id?: string
  amount?: number
  currency?: string
  description?: string
  buyerEmail?: string
  timestamp?: string
}

interface PaymentStatusProps {
  status: PaymentStatusType
  paymentDetails?: PaymentDetails
  error?: string
  onRetry?: () => void
  onClose?: () => void
  className?: string
}

export function PaymentStatus({
  status,
  paymentDetails,
  error,
  onRetry,
  onClose,
  className = ''
}: PaymentStatusProps) {
  
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        )
      case 'success':
        return (
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      default:
        return null
    }
  }

  const getStatusTitle = () => {
    switch (status) {
      case 'pending':
        return 'Processing Payment'
      case 'success':
        return 'Payment Successful!'
      case 'error':
        return 'Payment Failed'
      default:
        return ''
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'pending':
        return 'Please wait while we process your payment...'
      case 'success':
        return 'Your payment has been successfully processed. Thank you for your purchase!'
      case 'error':
        return error || 'Something went wrong while processing your payment. Please try again.'
      default:
        return ''
    }
  }

  const getStatusBackground = () => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'pending':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  if (status === 'idle') {
    return null
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 ${className}`}>
      <div className={`bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full ${getStatusBackground()} border`}>
        {/* Close button */}
        {onClose && status !== 'pending' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Status Icon */}
        <div className="text-center">
          {getStatusIcon()}
          
          {/* Status Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {getStatusTitle()}
          </h2>
          
          {/* Status Message */}
          <p className="text-gray-600 mb-6">
            {getStatusMessage()}
          </p>

          {/* Payment Details */}
          {status === 'success' && paymentDetails && (
            <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Payment Details</h3>
              <div className="space-y-2 text-sm">
                {paymentDetails.id && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transaction ID:</span>
                    <span className="font-medium text-gray-900">{paymentDetails.id}</span>
                  </div>
                )}
                {paymentDetails.amount && paymentDetails.currency && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium text-gray-900">
                      ${paymentDetails.amount.toFixed(2)} {paymentDetails.currency.toUpperCase()}
                    </span>
                  </div>
                )}
                {paymentDetails.description && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service:</span>
                    <span className="font-medium text-gray-900">{paymentDetails.description}</span>
                  </div>
                )}
                {paymentDetails.buyerEmail && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium text-gray-900">{paymentDetails.buyerEmail}</span>
                  </div>
                )}
                {paymentDetails.timestamp && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(paymentDetails.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {status === 'error' && onRetry && (
              <button
                onClick={onRetry}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                Try Again
              </button>
            )}
            
            {status === 'success' && onClose && (
              <button
                onClick={onClose}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                Continue
              </button>
            )}
            
            {status === 'error' && onClose && (
              <button
                onClick={onClose}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Loading component for inline use
export function PaymentLoading({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
        <p className="text-gray-600 text-sm">Processing payment...</p>
      </div>
    </div>
  )
}

// Success checkmark animation component
export function PaymentSuccess({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-green-800 font-semibold">Payment Successful!</p>
      </div>
    </div>
  )
}

// Error component for inline use
export function PaymentError({ 
  error, 
  onRetry, 
  className = '' 
}: { 
  error?: string
  onRetry?: () => void
  className?: string 
}) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-red-800 font-semibold mb-3">Payment Failed</p>
        <p className="text-red-600 text-sm mb-4">{error || 'Something went wrong'}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}

export default PaymentStatus