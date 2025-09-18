'use client'

import { useState, useEffect } from 'react'
import { BankAccountSubcard } from './BankAccountSubcard'
import { PayPalSubcard } from './PayPalSubcard'
import { PayPalModal } from './PayPalModal'
import { BankAccountModal } from './BankAccountModal'

interface PayoutMethodsCardProps {
  userId: string
}

export function PayoutMethodsCard({ userId }: PayoutMethodsCardProps) {
  const [showPayPalModal, setShowPayPalModal] = useState(false)
  const [showBankAccountModal, setShowBankAccountModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [userRole, setUserRole] = useState<string>('User')
  const [selectedPayoutMethod, setSelectedPayoutMethod] = useState<'bank_account' | 'paypal' | null>(null)
  const [hasPayPal, setHasPayPal] = useState(false)
  const [hasBankAccount, setHasBankAccount] = useState(false)

  useEffect(() => {
    loadUserRole()
    loadPayoutMethodStatuses()
  }, [userId])

  const loadUserRole = async () => {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const { userData } = await response.json()
        setUserRole(userData.role || 'User')
        setSelectedPayoutMethod(userData.preferred_payout_method || null)
        console.log('📋 [PAYOUT-METHODS] Loaded user profile:', {
          role: userData.role,
          preferredPayoutMethod: userData.preferred_payout_method
        })
      }
    } catch (error) {
      console.error('Error loading user role:', error)
    }
  }

  const loadPayoutMethodStatuses = async () => {
    try {
      // Check bank account status
      const bankResponse = await fetch('/api/user/bank-account', {
        method: 'GET',
        credentials: 'include'
      })

      if (bankResponse.ok) {
        const bankResult = await bankResponse.json()
        setHasBankAccount(bankResult.success && bankResult.data)
      }

      // Check PayPal status
      const paypalResponse = await fetch('/api/user/paypal-account', {
        method: 'GET',
        credentials: 'include'
      })

      if (paypalResponse.ok) {
        const paypalResult = await paypalResponse.json()
        setHasPayPal(paypalResult.success && paypalResult.data)
      }

      console.log('📋 [PAYOUT-METHODS] Loaded payout method statuses:', {
        hasBankAccount: hasBankAccount,
        hasPayPal: hasPayPal
      })
    } catch (error) {
      console.error('Error loading payout method statuses:', error)
    }
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
    setHasPayPal(true)

    // Auto-select PayPal if no method is currently selected
    if (!selectedPayoutMethod) {
      handlePayoutMethodSelection('paypal')
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
    setHasBankAccount(true)

    // Auto-select bank account if no method is currently selected
    if (!selectedPayoutMethod) {
      handlePayoutMethodSelection('bank_account')
    }
  }

  const handlePayoutMethodSelection = async (method: 'bank_account' | 'paypal') => {
    try {
      console.log('🎯 [PAYOUT-METHODS] Selecting payout method:', method)

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          preferred_payout_method: method
        })
      })

      if (response.ok) {
        const result = await response.json()
        setSelectedPayoutMethod(method)
        console.log('✅ [PAYOUT-METHODS] Payout method selection saved:', method)
      } else {
        console.error('❌ [PAYOUT-METHODS] Failed to save payout method selection')
      }
    } catch (error) {
      console.error('❌ [PAYOUT-METHODS] Error saving payout method selection:', error)
    }
  }

  return (
    <>
      <div className="flex-1 cosmic-card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">My Payout Methods</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <p className="text-gray-400 text-sm">Select your preferred payout method</p>
          </div>
          <div className="flex gap-3">
            <BankAccountSubcard
              key={`bank-${refreshKey}`}
              userId={userId}
              onClick={handleBankAccountClick}
              refreshKey={refreshKey}
              isSelected={selectedPayoutMethod === 'bank_account'}
              isConnected={hasBankAccount}
              onSelect={() => handlePayoutMethodSelection('bank_account')}
            />
            <PayPalSubcard
              key={`paypal-${refreshKey}`}
              userId={userId}
              onClick={handlePayPalClick}
              isSelected={selectedPayoutMethod === 'paypal'}
              isConnected={hasPayPal}
              onSelect={() => handlePayoutMethodSelection('paypal')}
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
      />

      {/* Bank Account Modal */}
      <BankAccountModal
        isOpen={showBankAccountModal}
        onClose={() => setShowBankAccountModal(false)}
        userId={userId}
        userRole={userRole}
        onSuccess={handleBankAccountSuccess}
      />
    </>
  )
}