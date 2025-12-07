'use client'

import { useState, useEffect } from 'react'

interface PayPalSubcardProps {
  userId: string
  onClick: () => void
  refreshKey?: number
  paypalAccountData?: PayPalAccount | null
  isSelected?: boolean
}

interface PayPalAccount {
  id: string
  email: string
  paypal_account_id: string | null
  is_verified: boolean
  status: string
}

export function PayPalSubcard({ userId, onClick, refreshKey, paypalAccountData, isSelected = false }: PayPalSubcardProps) {
  const [loading, setLoading] = useState(true)
  const [paypalAccount, setPaypalAccount] = useState<PayPalAccount | null>(null)

  useEffect(() => {
    // Use passed data if available, otherwise fallback to API call
    if (paypalAccountData !== undefined) {
      console.log('🔄 [PAYPAL-SUBCARD] Using passed data:', paypalAccountData)
      setPaypalAccount(paypalAccountData)
      setLoading(false)
    } else {
      console.log('🔄 [PAYPAL-SUBCARD] No data passed, loading from API for userId:', userId, 'refreshKey:', refreshKey)
      loadPayPalAccount()
    }
  }, [userId, refreshKey, paypalAccountData])

  const loadPayPalAccount = async () => {
    try {
      const response = await fetch('/api/user/paypal-account', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setPaypalAccount({
            id: result.data.id,
            email: result.data.email,
            paypal_account_id: result.data.paypal_account_id,
            is_verified: result.data.is_verified,
            status: result.data.status
          })
        }
      }
    } catch (error) {
      console.error('Error loading PayPal account:', error)
    } finally {
      setLoading(false)
    }
  }

  const maskEmail = (email: string) => {
    if (!email || !email.includes('@')) return email
    const [username, domain] = email.split('@')
    if (username.length <= 2) return email
    return username.charAt(0) + '•••' + '@' + domain
  }

  const getStatusIcon = () => {
    if (paypalAccount) {
      return (
        <div className="w-5 h-5 bg-green-600/80 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="w-full md:flex-1 bg-white/5 rounded-lg p-4 border border-gray-700 cursor-pointer hover:bg-white/8 transition-colors">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-gray-700 rounded" />
            <div className="w-4 h-4 bg-gray-700 rounded-full" />
          </div>
          <div className="h-4 w-20 bg-gray-700 rounded mb-2" />
          <div className="h-3 w-24 bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`w-full md:flex-1 bg-white/5 rounded-lg p-2.5 md:p-3 border ${
        isSelected ? 'border-purple-500' : 'border-gray-700'
      } cursor-pointer hover:border-purple-500 hover:bg-white/8 transition-all group relative`}
    >
      {getStatusIcon() && (
        <div className="absolute -top-2 -right-2 z-10">
          {getStatusIcon()}
        </div>
      )}
      <div className="flex items-center justify-between mb-2 md:mb-1">
        <h4 className="text-white font-medium text-sm md:text-sm">PayPal</h4>
        <div className="w-6 h-6 md:w-7 md:h-7 bg-purple-600/20 rounded-lg flex items-center justify-center">
          {/* PayPal P logo */}
          <div className="w-4 h-4 md:w-4 md:h-4 text-purple-400 font-bold text-xs md:text-xs flex items-center justify-center">
            P
          </div>
        </div>
      </div>
      
      <div>
        {paypalAccount ? (
          <p className="text-white text-[10px] md:text-[10px] font-mono">
            {maskEmail(paypalAccount.email)}
          </p>
        ) : (
          <p className="text-gray-400 text-xs md:text-xs">Not connected</p>
        )}
      </div>
    </div>
  )
}