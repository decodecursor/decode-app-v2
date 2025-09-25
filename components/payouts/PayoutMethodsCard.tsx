'use client'

import { useState, useEffect } from 'react'
import { BankAccountSubcard } from './BankAccountSubcard'
import { PayPalSubcard } from './PayPalSubcard'
import { PayPalModal } from './PayPalModal'
import { BankAccountModal } from './BankAccountModal'

interface PayoutMethodsCardProps {
  userId: string
  userRole?: string
  onMethodDeleted?: () => void
  bankAccountData?: any
  paypalAccountData?: any
}

export function PayoutMethodsCard({ userId, userRole = 'User', onMethodDeleted, bankAccountData, paypalAccountData }: PayoutMethodsCardProps) {
  const [showPayPalModal, setShowPayPalModal] = useState(false)
  const [showBankAccountModal, setShowBankAccountModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Helper function to get card titles based on user role
  const getCardTitle = (baseTitle: string) => {
    return userRole === 'Admin' ? baseTitle.replace('My', 'Company') : baseTitle
  }

  const handleBankAccountClick = () => {
    setShowBankAccountModal(true)
  }

  const handlePayPalClick = () => {
    setShowPayPalModal(true)
  }

  const handlePayPalSuccess = () => {
    // Trigger refresh of PayPal subcard
    setRefreshKey(prev => prev + 1)
    // Notify parent about method change (addition)
    if (onMethodDeleted) {
      onMethodDeleted()
    }
  }

  const handleMethodDeleted = () => {
    // Trigger refresh of subcards and notify parent
    setRefreshKey(prev => prev + 1)
    if (onMethodDeleted) {
      onMethodDeleted()
    }
  }

  const handleBankAccountSuccess = () => {
    // Trigger refresh of Bank Account subcard
    const newKey = refreshKey + 1
    console.log('🔄 [PAYOUT-METHODS] Bank account success - updating refresh key:', {
      oldKey: refreshKey,
      newKey: newKey
    })
    setRefreshKey(newKey)
    // Notify parent about method change (addition)
    if (onMethodDeleted) {
      onMethodDeleted()
    }
  }

  return (
    <>
      <div className="flex-1 cosmic-card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">{getCardTitle('My Payout Methods')}</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <p className="text-gray-400 text-sm">Manage your payout preferences</p>
          </div>
          <div className="flex gap-3">
            <BankAccountSubcard
              key={`bank-${refreshKey}`}
              userId={userId}
              onClick={handleBankAccountClick}
              refreshKey={refreshKey}
              bankAccountData={bankAccountData}
            />
            <PayPalSubcard
              key={`paypal-${refreshKey}`}
              userId={userId}
              onClick={handlePayPalClick}
              refreshKey={refreshKey}
              paypalAccountData={paypalAccountData}
            />
          </div>
        </div>
      </div>

      {/* PayPal Modal */}
      <PayPalModal
        isOpen={showPayPalModal}
        onClose={() => setShowPayPalModal(false)}
        userId={userId}
        onSuccess={handlePayPalSuccess}
        onMethodDeleted={handleMethodDeleted}
      />

      {/* Bank Account Modal */}
      <BankAccountModal
        isOpen={showBankAccountModal}
        onClose={() => setShowBankAccountModal(false)}
        userId={userId}
        userRole={userRole}
        onSuccess={handleBankAccountSuccess}
        onMethodDeleted={handleMethodDeleted}
      />
    </>
  )
}