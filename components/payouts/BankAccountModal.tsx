'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface BankAccountModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  onSuccess: () => void
  userRole?: string
}

export function BankAccountModal({ isOpen, onClose, userId, onSuccess, userRole }: BankAccountModalProps) {
  const [loading, setLoading] = useState(false)
  const [beneficiary, setBeneficiary] = useState('')
  const [iban, setIban] = useState('')
  const [bank, setBank] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load existing bank account data
  useEffect(() => {
    if (isOpen && userId) {
      loadExistingBankAccount()
    }
  }, [isOpen, userId])

  const loadExistingBankAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('user_bank_account')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single()

      if (!error && data) {
        setBeneficiary(data.beneficiary_name || '')
        setIban(data.iban_number || '')
        setBank(data.bank_name || '')
        setIsConnected(true)
      }
    } catch (error) {
      console.error('Error loading existing bank account:', error)
    }
  }

  if (!isOpen) return null

  const handleSaveBankAccount = async () => {
    if (!beneficiary.trim() || !iban.trim() || !bank.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      // Try to insert or update bank account
      const bankAccountData = {
        user_id: userId,
        beneficiary_name: beneficiary.trim(),
        iban_number: iban.trim(),
        bank_name: bank.trim(),
        is_primary: true,
        status: 'pending'
      }

      // Check if user already has a bank account
      const { data: existingAccount } = await supabase
        .from('user_bank_account')
        .select('id')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single()

      let error
      if (existingAccount) {
        // Update existing account
        const { error: updateError } = await supabase
          .from('user_bank_account')
          .update(bankAccountData)
          .eq('id', existingAccount.id)
        error = updateError
      } else {
        // Insert new account
        const { error: insertError } = await supabase
          .from('user_bank_account')
          .insert(bankAccountData)
        error = insertError
      }

      if (error) {
        if (error.message.includes('relation "user_bank_account" does not exist')) {
          setMessage({ 
            type: 'error', 
            text: 'Bank account table not set up yet. Please contact support to enable this feature.' 
          })
          return
        }
        throw error
      }

      setIsConnected(true)
      setMessage({ type: 'success', text: 'Bank account saved successfully!' })
      
      // Call success callback and close modal after a brief delay
      setTimeout(() => {
        onSuccess()
        onClose()
        setMessage(null)
      }, 1500)

    } catch (error) {
      console.error('Error saving bank account:', error)
      console.error('Full error object:', JSON.stringify(error, null, 2))
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save bank account' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!isConnected) {
      setBeneficiary('')
      setIban('')
      setBank('')
    }
    setMessage(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-8 w-full max-w-md relative">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {userRole === 'User' ? 'Add Your Personal Bank Account' : 'Add Company Bank Account'}
          </h2>
          <p className="text-gray-400 text-sm">Connect your bank account to receive payouts</p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-600/20 text-green-100 border border-green-500/30' 
              : 'bg-red-600/20 text-red-100 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Success indicator */}
        {isConnected && (
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-600/20 text-green-400 border border-green-500/30">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Bank Account Connected
            </div>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Beneficiary
            </label>
            <input
              type="text"
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder={userRole === 'User' ? 'John Smith' : 'Boho Beauty Salon'}
              className="cosmic-input w-full"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              IBAN
            </label>
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="AE 0700 3001 2769 3138 2000 1"
              className="cosmic-input w-full"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bank
            </label>
            <input
              type="text"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="RAK Bank"
              className="cosmic-input w-full"
              disabled={loading}
            />
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-blue-100 text-sm">
              <p className="font-medium mb-1">Important:</p>
              <ul className="space-y-1 text-xs">
                <li>• Use the IBAN format for UAE bank accounts</li>
                <li>• Beneficiary name must match your account holder name</li>
                <li>• Payouts are typically processed within 1-2 business days</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 cosmic-button-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveBankAccount}
            disabled={loading || !beneficiary || !iban || !bank}
            className="flex-1 cosmic-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : isConnected ? 'Update Account' : 'Connect Bank Account'}
          </button>
        </div>
      </div>
    </div>
  )
}