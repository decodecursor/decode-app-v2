'use client'

import React from 'react'
import { PaymentPage } from '@/components/payment/PaymentPage'
import { CrossmintProvider } from '@/components/crossmint/CrossmintProvider'

export default function PaymentTestPage() {
  return (
    <CrossmintProvider>
      <div className="min-h-screen bg-gray-100 py-8">
        <PaymentPage
          amount={50}
          currency="USD"
          description="Test Payment - Beauty Service"
          onSuccess={(sessionId) => {
            alert(`Payment successful! Session ID: ${sessionId}`)
          }}
          onFailure={(error) => {
            alert(`Payment failed: ${error}`)
          }}
        />
      </div>
    </CrossmintProvider>
  )
}