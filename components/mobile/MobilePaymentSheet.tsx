'use client'

import React, { useState, useEffect } from 'react'
import { CrossmintPaymentElement } from '@crossmint/client-sdk-react-ui'

export interface MobilePaymentSheetProps {
  isOpen: boolean
  onClose: () => void
  paymentLinkId: string
  originalAmount: number
  currency: string
  onSuccess: (sessionId: string) => void
  onFailure: (error: string) => void
  serviceTitle: string
  creatorName: string
  clientEmail?: string
  disabled?: boolean
}

export function MobilePaymentSheet({
  isOpen,
  onClose,
  paymentLinkId,
  originalAmount,
  currency,
  onSuccess,
  onFailure,
  serviceTitle,
  creatorName,
  clientEmail,
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

          {/* Payment handled by embedded Crossmint component */}
          <div className="space-y-4">
            <CrossmintPaymentElement
              projectId={process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID || ''}
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
                paymentLinkId: paymentLinkId,
                beautyProfessionalId: creatorName,
                service: 'beauty',
                title: serviceTitle,
                originalAmount: originalAmount,
                originalCurrency: currency
              }}
            />
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