'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface PayPalSubcardProps {
  userId: string
  onClick: () => void
}

interface PayPalAccount {
  id: string
  email: string
  paypal_account_id: string | null
  is_verified: boolean
  status: string
}

export function PayPalSubcard({ userId, onClick }: PayPalSubcardProps) {
  const [loading, setLoading] = useState(true)
  const [paypalAccount, setPaypalAccount] = useState<PayPalAccount | null>(null)

  useEffect(() => {
    loadPayPalAccount()
  }, [userId])

  const loadPayPalAccount = async () => {
    try {
      // Try loading from user_paypal_accounts table
      const { data, error } = await supabase
        .from('user_paypal_account')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single()

      if (!error && data) {
        setPaypalAccount(data)
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
        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
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
      <div className="flex-1 bg-white/5 rounded-lg p-4 border border-gray-700 cursor-pointer hover:bg-white/8 transition-colors">
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
      className="flex-1 bg-white/5 rounded-lg p-3 border border-gray-700 cursor-pointer hover:border-purple-500 hover:bg-white/8 transition-all group"
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-white font-medium text-sm">PayPal</h4>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div className="w-7 h-7 bg-purple-600/20 rounded-lg flex items-center justify-center">
            {/* PayPal P logo */}
            <div className="w-4 h-4 text-purple-400 font-bold text-xs flex items-center justify-center">
              P
            </div>
          </div>
        </div>
      </div>
      
      <div>
        {paypalAccount ? (
          <p className="text-gray-400 text-xs font-mono">
            {maskEmail(paypalAccount.email)}
          </p>
        ) : (
          <p className="text-gray-400 text-xs">Not connected</p>
        )}
      </div>
    </div>
  )
}