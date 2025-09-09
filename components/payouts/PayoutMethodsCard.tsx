'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BankAccountSubcard } from './BankAccountSubcard'
import { PayPalSubcard } from './PayPalSubcard'
import { PayPalModal } from './PayPalModal'

interface PayoutMethodsCardProps {
  userId: string
}

export function PayoutMethodsCard({ userId }: PayoutMethodsCardProps) {
  const router = useRouter()
  const [showPayPalModal, setShowPayPalModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleBankAccountClick = () => {
    // Navigate to the existing bank account page
    router.push('/bank-account')
  }

  const handlePayPalClick = () => {
    setShowPayPalModal(true)
  }

  const handlePayPalSuccess = () => {
    // Trigger refresh of PayPal subcard
    setRefreshKey(prev => prev + 1)
  }

  return (
    <>
      <div className="flex-1 cosmic-card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">My Payout Methods</h3>
          <p className="text-gray-400 text-sm mt-1">Manage your payout preferences</p>
        </div>
        
        <div className="flex gap-3">
          <BankAccountSubcard 
            userId={userId} 
            onClick={handleBankAccountClick}
          />
          <PayPalSubcard 
            key={refreshKey}
            userId={userId} 
            onClick={handlePayPalClick}
          />
        </div>

        {/* Professional footer info */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Secure & encrypted</span>
            <div className="flex items-center space-x-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>SSL Protected</span>
            </div>
          </div>
        </div>
      </div>

      {/* PayPal Modal */}
      <PayPalModal
        isOpen={showPayPalModal}
        onClose={() => setShowPayPalModal(false)}
        userId={userId}
        onSuccess={handlePayPalSuccess}
      />
    </>
  )
}