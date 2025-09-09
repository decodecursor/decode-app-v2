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
      className="flex-1 bg-white/5 rounded-lg p-4 border border-gray-700 cursor-pointer hover:bg-white/8 transition-colors group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Hover indicator */}
      <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>
    </div>
  )
}