'use client'

import React, { useState } from 'react'
import { CrossmintPaymentElement } from '@crossmint/client-sdk-react-ui'
import { crossmintConfig } from '@/lib/crossmint-config'

interface PaymentPageProps {
  amount: number
  currency: string
  description: string
  onSuccess?: (sessionId: string) => void
  onFailure?: (error: string) => void
}

export function PaymentPage({ 
  amount, 
  currency, 
  description, 
  onSuccess, 
  onFailure 
}: PaymentPageProps) {
  const [paymentMethod, setPaymentMethod] = useState<'fiat' | 'ETH' | 'SOL'>('fiat')

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Complete Payment</h2>
      <div className="mb-6">
        <p className="text-gray-600 mb-2">{description}</p>
        <p className="text-2xl font-bold text-gray-900">{amount} {currency}</p>
      </div>
      
      {/* Payment Method Selector */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Choose Payment Method</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setPaymentMethod('fiat')}
            className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
              paymentMethod === 'fiat' 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            💳 Card/Apple/Google Pay
          </button>
          <button
            onClick={() => setPaymentMethod('ETH')}
            className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
              paymentMethod === 'ETH' 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            🔗 Crypto Wallet
          </button>
        </div>
      </div>
      
      <CrossmintPaymentElement
        clientId={crossmintConfig.projectId}
        environment={crossmintConfig.environment}
        currency="USD"
        locale="en-US"
        paymentMethod={paymentMethod}
        uiConfig={{
          colors: {
            accent: '#7C3AED',
            background: '#FFFFFF',
            textPrimary: '#111827'
          }
        }}
        whPassThroughArgs={{
          testPayment: true,
          description: description,
          originalAmount: amount,
          originalCurrency: currency
        }}
      />
    </div>
  )
}

export default PaymentPage