'use client'

import React, { useState } from 'react'
import { calculateMarketplaceFee } from '@/types/crossmint'

interface CrossmintHeadlessCheckoutProps {
  paymentLinkId: string
  originalAmount: number
  currency: string
  title: string
  clientEmail?: string
  onSuccess?: (sessionId: string) => void
  onFailure?: (error: string) => void
  disabled?: boolean
  className?: string
}

export function CrossmintHeadlessCheckout({
  paymentLinkId,
  originalAmount,
  currency,
  title,
  clientEmail,
  onSuccess,
  onFailure,
  disabled = false,
  className = ''
}: CrossmintHeadlessCheckoutProps) {
  const [loading, setLoading] = useState(false)
  const [selectedCrypto, setSelectedCrypto] = useState<'usdc' | 'eth' | 'matic'>('usdc')
  const [email, setEmail] = useState(clientEmail || '')
  const [emailError, setEmailError] = useState('')

  // Calculate marketplace fee
  const feeCalculation = calculateMarketplaceFee(originalAmount)
  
  const isValidEmail = (email: string) => {
    if (!email.trim()) return true // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)
    
    if (value.trim() && !isValidEmail(value)) {
      setEmailError('Please enter a valid email address')
    } else {
      setEmailError('')
    }
  }

  const handlePayment = async () => {
    if (email.trim() && !isValidEmail(email)) {
      setEmailError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setEmailError('')

    try {
      console.log('🚀 Creating headless checkout session...')
      
      // Create checkout session
      const response = await fetch('/api/payment/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentLinkId,
          clientEmail: email.trim() || undefined,
          currency: selectedCrypto.toUpperCase()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      if (!data.success || !data.sessionId) {
        throw new Error('Invalid response from server')
      }

      console.log('✅ Checkout session created:', data.sessionId)
      
      // Check if we have a real checkout URL
      if (data.checkoutUrl) {
        console.log('🔄 Redirecting to Crossmint checkout:', data.checkoutUrl)
        // Redirect to the generated Crossmint checkout URL
        window.location.href = data.checkoutUrl
        onSuccess?.(data.sessionId)
      } else if (data.sessionId.startsWith('mock_session_') || data.sessionId.startsWith('decode_')) {
        alert('⚠️ Demo Mode: Checkout URL not provided. Check server logs for details.')
        onSuccess?.(data.sessionId)
      } else {
        // Fallback for older format
        const environment = process.env.CROSSMINT_ENVIRONMENT || 'production'
        const baseUrl = environment === 'staging' ? 'https://staging.crossmint.com' : 'https://crossmint.com'
        const checkoutUrl = `${baseUrl}/checkout/${data.sessionId}`
        window.location.href = checkoutUrl
        onSuccess?.(data.sessionId)
      }

    } catch (error) {
      console.error('❌ Checkout session creation failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start payment'
      onFailure?.(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const cryptoOptions = [
    {
      id: 'usdc',
      name: 'USDC',
      description: 'USD Coin - Stablecoin',
      icon: '💲',
      recommended: true
    },
    {
      id: 'eth',
      name: 'ETH',
      description: 'Ethereum',
      icon: '⟡',
      recommended: false
    },
    {
      id: 'matic',
      name: 'MATIC',
      description: 'Polygon',
      icon: '🔷',
      recommended: false
    }
  ]

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Amount Display */}
      <div className="bg-gray-50 rounded-xl p-6">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">Payment Amount</h3>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">Service: {currency} {originalAmount.toFixed(2)}</p>
            <p className="text-sm text-gray-600">Marketplace Fee (11%): {currency} {feeCalculation.feeAmount.toFixed(2)}</p>
            <div className="border-t pt-2">
              <p className="text-2xl font-bold text-gray-900">
                {currency} {feeCalculation.totalAmount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">Total you pay</p>
            </div>
          </div>
        </div>
      </div>

      {/* Crypto Selection */}
      <div className="space-y-3">
        <h4 className="text-base font-semibold text-gray-900">Select Cryptocurrency</h4>
        <div className="grid gap-3">
          {cryptoOptions.map((crypto) => (
            <button
              key={crypto.id}
              onClick={() => setSelectedCrypto(crypto.id as 'usdc' | 'eth' | 'matic')}
              className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all ${
                selectedCrypto === crypto.id
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl">{crypto.icon}</div>
              <div className="flex-1 text-left">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900">{crypto.name}</span>
                  {crypto.recommended && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{crypto.description}</p>
              </div>
              <div className="flex-shrink-0">
                <div className={`w-5 h-5 rounded-full border-2 ${
                  selectedCrypto === crypto.id
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-gray-300'
                }`}>
                  {selectedCrypto === crypto.id && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Email Input */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email Address (Optional)
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="your@email.com"
          className={`w-full px-4 py-3 border rounded-xl transition-colors ${
            emailError
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-purple-500 focus:ring-purple-200'
          } focus:outline-none focus:ring-2`}
        />
        {emailError && (
          <p className="text-sm text-red-600">{emailError}</p>
        )}
        <p className="text-xs text-gray-500">
          Email is optional but recommended for payment confirmation
        </p>
      </div>

      {/* Payment Button */}
      <button
        onClick={handlePayment}
        disabled={disabled || loading || !!emailError}
        className="w-full py-4 px-6 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center space-x-2"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Creating checkout session...</span>
          </>
        ) : (
          <>
            <span>Pay with {selectedCrypto.toUpperCase()}</span>
            <span className="text-purple-200">→</span>
          </>
        )}
      </button>

      {/* Security Notice */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          🔒 Secure payment processing with Crossmint • Your information is protected
        </p>
      </div>
    </div>
  )
}

export default CrossmintHeadlessCheckout