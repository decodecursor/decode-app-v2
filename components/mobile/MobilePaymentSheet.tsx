'use client'

import React, { useState, useEffect } from 'react'
import { CrossmintPaymentButton } from '@/components/crossmint'
import type { PaymentData } from '@/components/crossmint'

export interface MobilePaymentSheetProps {
  isOpen: boolean
  onClose: () => void
  paymentData: PaymentData
  onSuccess: (payment: any) => void
  onFailure: (error: any) => void
  onPending: () => void
  serviceTitle: string
  creatorName: string
  disabled?: boolean
}

export function MobilePaymentSheet({
  isOpen,
  onClose,
  paymentData,
  onSuccess,
  onFailure,
  onPending,
  serviceTitle,
  creatorName,
  disabled = false
}: MobilePaymentSheetProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger animation
      setTimeout(() => setIsVisible(true), 10)
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden'
    } else {
      setIsVisible(false)
      document.body.style.overflow = 'unset'
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleSwipeDown = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    
    const startY = touch.clientY
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const currentTouch = moveEvent.touches[0]
      if (!currentTouch) return
      
      const currentY = currentTouch.clientY
      const deltaY = currentY - startY
      
      // If user swipes down more than 100px, close the sheet
      if (deltaY > 100) {
        onClose()
        document.removeEventListener('touchmove', handleTouchMove)
      }
    }
    
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    
    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
    
    document.addEventListener('touchend', handleTouchEnd, { once: true })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 ease-out ${
          isVisible ? 'opacity-50' : 'opacity-0'
        }`}
        onClick={handleBackdropClick}
      />
      
      {/* Payment Sheet */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out max-h-[90vh] overflow-hidden ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onTouchStart={handleSwipeDown}
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Sheet Content */}
        <div className="px-6 pb-6 overflow-y-auto max-h-[calc(90vh-60px)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Complete Payment</h2>
              <p className="text-sm text-gray-600 mt-1">Secure payment with Crossmint</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close payment sheet"
            >
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Payment Summary */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Payment Summary</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{serviceTitle}</p>
                  <p className="text-xs text-gray-600">by {creatorName}</p>
                </div>
                <p className="text-lg font-bold text-gray-900 ml-3">
                  ${paymentData.amount.toFixed(2)}
                </p>
              </div>
              
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">Total</span>
                  <span className="text-xl font-bold text-purple-600">
                    ${paymentData.amount.toFixed(2)} {paymentData.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Methods Section */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Payment Method</h3>
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Crossmint</p>
                  <p className="text-xs text-gray-600">Card • Bank • Crypto</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Button */}
          <div className="space-y-4">
            <CrossmintPaymentButton
              paymentData={paymentData}
              onSuccess={onSuccess}
              onFailure={onFailure}
              onPending={onPending}
              disabled={disabled}
              buttonText={`Pay $${paymentData.amount.toFixed(2)}`}
              size="lg"
              className="w-full min-h-[56px] text-lg font-semibold"
            />
            
            {/* Security Notice */}
            <div className="flex items-center justify-center space-x-2 text-gray-500 text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Secured by 256-bit SSL encryption</span>
            </div>
          </div>

          {/* Terms */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              By completing this payment, you agree to the service terms and conditions. 
              Your payment will be processed securely through Crossmint.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobilePaymentSheet