'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface BankAccountSubcardProps {
  userId: string
  onClick: () => void
}

interface BankAccount {
  id: string
  iban_number: string
  bank_name: string
  beneficiary_name: string
  is_verified: boolean
  status: string
}

export function BankAccountSubcard({ userId, onClick }: BankAccountSubcardProps) {
  const [loading, setLoading] = useState(true)
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null)

  useEffect(() => {
    loadBankAccount()
  }, [userId])

  const loadBankAccount = async () => {
    try {
      // Try loading from user_bank_accounts table
      const { data, error } = await supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single()

      if (!error && data) {
        setBankAccount(data)
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
    if (bankAccount?.is_verified || bankAccount?.status === 'active') {
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
          <div className="h-4 w-24 bg-gray-700 rounded mb-2" />
          <div className="h-3 w-16 bg-gray-700 rounded" />
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
        <div className="w-7 h-7 bg-blue-600/20 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        {getStatusIcon()}
      </div>
      
      <div>
        <h4 className="text-white font-medium text-sm mb-1">Bank Account</h4>
        {bankAccount ? (
          <div className="space-y-1">
            <p className="text-gray-400 text-xs font-mono">
              {maskIban(bankAccount.iban_number)}
            </p>
            <p className="text-gray-500 text-xs truncate">
              {bankAccount.bank_name}
            </p>
          </div>
        ) : (
          <p className="text-gray-400 text-xs">Not connected</p>
        )}
      </div>
    </div>
  )
}