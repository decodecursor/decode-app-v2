'use client'

import { useState, useEffect } from 'react'
import { BankAccountSubcard } from './BankAccountSubcard'
import { PayPalSubcard } from './PayPalSubcard'
import { PayPalModal } from './PayPalModal'
import { BankAccountModal } from './BankAccountModal'
import { supabase } from '@/lib/supabase'

interface PayoutMethodsCardProps {
  userId: string
}

export function PayoutMethodsCard({ userId }: PayoutMethodsCardProps) {
  const [showPayPalModal, setShowPayPalModal] = useState(false)
  const [showBankAccountModal, setShowBankAccountModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [userRole, setUserRole] = useState<string>('User')

  useEffect(() => {
    loadUserRole()
  }, [userId])

  const loadUserRole = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (!error && data) {
        setUserRole(data.role || 'User')
      }
    } catch (error) {
      console.error('Error loading user role:', error)
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
  }

  const handleBankAccountSuccess = () => {
    // Trigger refresh of Bank Account subcard
    setRefreshKey(prev => prev + 1)
  }

  return (
    <>
      <div className="flex-1 cosmic-card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">My Payout Methods</h3>
          <p className="text-gray-400 text-sm">Manage your payout preferences</p>
        </div>
        
        <div className="flex gap-3">
          <BankAccountSubcard 
            key={`bank-${refreshKey}`}
            userId={userId} 
            onClick={handleBankAccountClick}
          />
          <PayPalSubcard 
            key={`paypal-${refreshKey}`}
            userId={userId} 
            onClick={handlePayPalClick}
          />
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