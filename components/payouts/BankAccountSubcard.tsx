'use client'

import { useState, useEffect } from 'react'

interface BankAccountSubcardProps {
  userId: string
  onClick: () => void
  refreshKey?: number
}

interface BankAccount {
  id: string
  iban_number: string
  bank_name: string
  beneficiary_name: string
  is_verified: boolean
  status: string
}

export function BankAccountSubcard({ userId, onClick, refreshKey }: BankAccountSubcardProps) {
  const [loading, setLoading] = useState(true)
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null)

  useEffect(() => {
    console.log('🔄 [BANK-SUBCARD] Component mounted/updated, loading bank account for userId:', userId, 'refreshKey:', refreshKey)
    loadBankAccount()
  }, [userId, refreshKey])

  const loadBankAccount = async () => {
    try {
      console.log('📤 [BANK-SUBCARD] Loading bank account data...')

      // First check for manually added bank account
      const response = await fetch('/api/user/bank-account', {
        method: 'GET',
        credentials: 'include'
      })

      console.log('📥 [BANK-SUBCARD] API response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (response.ok) {
        const result = await response.json()
        console.log('📋 [BANK-SUBCARD] API response data:', result)

        if (result.success && result.data) {
          const accountData = {
            id: result.data.id,
            iban_number: result.data.iban_number,
            bank_name: result.data.bank_name,
            beneficiary_name: result.data.beneficiary_name,
            is_verified: result.data.is_verified,
            status: result.data.status
          }

          console.log('✅ [BANK-SUBCARD] Setting bank account data:', accountData)
          setBankAccount(accountData)
          setLoading(false)
          return
        } else {
          console.log('ℹ️ [BANK-SUBCARD] No bank account data in response')
        }
      } else {
        console.error('❌ [BANK-SUBCARD] API request failed:', {
          status: response.status,
          statusText: response.statusText
        })
      }

      // Fallback to check Stripe Connect status
      const profileResponse = await fetch('/api/user/profile', {
        method: 'GET',
        credentials: 'include'
      })

      if (profileResponse.ok) {
        const { userData } = await profileResponse.json()
        if (userData && userData.stripe_connect_status === 'active') {
          setBankAccount({
            id: 'stripe',
            iban_number: '****connected',
            bank_name: 'Stripe Connect',
            beneficiary_name: userData.user_name || 'User',
            is_verified: true,
            status: 'active'
          })
        }
      }
    } catch (error) {
      console.error('Error loading bank account:', error)
    } finally {
      setLoading(false)
    }
  }

  const maskIban = (iban: string) => {
    if (!iban || iban.length < 4) return iban
    return '••••' + iban.slice(-4)
  }

  const getStatusIcon = () => {
    console.log('🎨 [BANK-SUBCARD] getStatusIcon called, bankAccount:', bankAccount ? 'exists' : 'null')
    if (bankAccount) {
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
    console.log('⏳ [BANK-SUBCARD] Rendering loading state')
    return (
      <div className="flex-1 bg-white/5 rounded-lg p-4 border border-gray-700 cursor-pointer hover:bg-white/8 transition-colors">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-gray-700 rounded" />
            <div className="w-4 h-4 bg-gray-700 rounded-full" />
          </div>
          <div className="h-4 w-24 bg-gray-700 rounded mb-2" />
          <div className="h-3 w-16 bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  console.log('🎨 [BANK-SUBCARD] Rendering main component, bankAccount:', {
    hasAccount: !!bankAccount,
    accountData: bankAccount ? {
      id: bankAccount.id,
      bankName: bankAccount.bank_name,
      ibanMasked: maskIban(bankAccount.iban_number)
    } : null
  })

  return (
    <div 
      onClick={onClick}
      className="flex-1 bg-white/5 rounded-lg p-3 border border-gray-700 cursor-pointer hover:border-purple-500 hover:bg-white/8 transition-all group relative"
    >
      {getStatusIcon() && (
        <div className="absolute -top-2 -right-2 z-10">
          {getStatusIcon()}
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-white font-medium text-sm">Bank Account</h4>
        <div className="w-7 h-7 bg-purple-600/20 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
      </div>
      
      <div>
        {bankAccount ? (
          <p className="text-gray-400 text-xs font-mono">
            {maskIban(bankAccount.iban_number)} • {bankAccount.bank_name}
          </p>
        ) : (
          <p className="text-gray-400 text-xs">Not connected</p>
        )}
      </div>
    </div>
  )
}