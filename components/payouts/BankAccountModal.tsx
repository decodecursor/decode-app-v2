'use client'

import { useState, useEffect } from 'react'
import { ConfirmationModal } from './ConfirmationModal'
import { USER_ROLES } from '@/types/user'

interface BankAccountModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  onSuccess: () => void
  userRole?: string
  onMethodDeleted?: () => void
}

export function BankAccountModal({ isOpen, onClose, userId, onSuccess, userRole, onMethodDeleted }: BankAccountModalProps) {
  const [loading, setLoading] = useState(false)
  const [beneficiary, setBeneficiary] = useState('')
  const [iban, setIban] = useState('')
  const [bank, setBank] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false)
  const [removeLoading, setRemoveLoading] = useState(false)

  // Load existing bank account data
  useEffect(() => {
    if (isOpen && userId) {
      loadExistingBankAccount()
    }
  }, [isOpen, userId])

  const loadExistingBankAccount = async () => {
    try {
      const response = await fetch('/api/user/bank-account', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          const bankAccount = result.data
          setBeneficiary(bankAccount.beneficiary_name || '')
          setIban(bankAccount.iban_number || '')
          setBank(bankAccount.bank_name || '')
          setIsConnected(true)
        }
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
      const method = isConnected ? 'PUT' : 'POST'
      const requestData = {
        beneficiary_name: beneficiary.trim(),
        iban_number: iban.trim(),
        bank_name: bank.trim()
      }

      console.log('📤 [BANK-MODAL] Sending request:', {
        method,
        url: '/api/user/bank-account',
        data: requestData
      })

      const response = await fetch('/api/user/bank-account', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData)
      })

      console.log('📥 [BANK-MODAL] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      const result = await response.json()
      console.log('📋 [BANK-MODAL] Response data:', result)

      if (response.ok && result.success) {
        console.log('✅ [BANK-MODAL] Bank account saved successfully')
        setMessage({ type: 'success', text: result.message || 'Bank account saved successfully!' })
        setIsConnected(true)

        // Trigger refresh immediately to update the card
        console.log('🔄 [BANK-MODAL] Triggering refresh callback immediately')
        onSuccess()

        // Add a small delay to ensure database consistency, then trigger another refresh
        setTimeout(() => {
          console.log('🔄 [BANK-MODAL] Triggering delayed refresh for database consistency')
          onSuccess()
        }, 500)

        // Close modal after a brief delay to show success message
        setTimeout(() => {
          onClose()
          setMessage(null)
        }, 1500)
      } else {
        console.error('❌ [BANK-MODAL] Failed to save bank account:', {
          status: response.status,
          result
        })

        // Show detailed error message including API details if available
        const errorMessage = result.details
          ? `${result.error}: ${result.details}`
          : result.error || 'Failed to save bank account'

        setMessage({
          type: 'error',
          text: errorMessage
        })
      }

    } catch (error) {
      console.error('❌ [BANK-MODAL] Network/request error:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Network error - please try again'
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
    setShowRemoveConfirmation(false)
    onClose()
  }

  const handleRemoveAccount = async () => {
    setRemoveLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user/bank-account', {
        method: 'DELETE',
        credentials: 'include'
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage({
          type: 'success',
          text: 'Bank account removed successfully!'
        })

        // Reset form state
        setBeneficiary('')
        setIban('')
        setBank('')
        setIsConnected(false)
        setShowRemoveConfirmation(false)

        // Trigger parent refresh
        onSuccess()

        // Notify about method deletion
        if (onMethodDeleted) {
          onMethodDeleted()
        }

        // Close modal after a brief delay
        setTimeout(() => {
          onClose()
          setMessage(null)
        }, 1500)
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to remove bank account'
        })
        setShowRemoveConfirmation(false)
      }
    } catch (error) {
      console.error('Error removing bank account:', error)
      setMessage({
        type: 'error',
        text: 'Network error - please try again'
      })
      setShowRemoveConfirmation(false)
    } finally {
      setRemoveLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 md:p-8 p-6 w-full max-w-md relative">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute md:top-4 md:right-4 top-2 right-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center md:mb-8 mb-6">
          <div className="md:w-16 md:h-16 w-14 h-14 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="md:w-8 md:h-8 w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h2 className="md:text-2xl text-xl font-bold text-white mb-2">
            {userRole === USER_ROLES.STAFF || userRole === USER_ROLES.MODEL ? 'Add Your Bank Account' : 'Add Company Bank Account'}
          </h2>
          <p className="text-gray-400 md:text-sm text-xs">
            {userRole === USER_ROLES.STAFF || userRole === USER_ROLES.MODEL ? 'Connect your bank account to receive payouts' : 'Connect company bank account to receive payouts'}
          </p>
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
            <div className="inline-flex items-center px-3 py-1 rounded-full font-medium bg-green-600/20 text-green-400 border border-green-500/30" style={{fontSize: '10px'}}>
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
              placeholder={userRole === USER_ROLES.STAFF ? 'Sarah Johnson' : 'Glow Beauty Salon'}
              className="w-full md:px-4 md:py-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
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
              className="w-full md:px-4 md:py-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
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
              className="w-full md:px-4 md:py-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
              disabled={loading}
            />
          </div>
        </div>

        {/* Info box */}
        <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg md:p-4 p-3 mb-6">
          <div className="text-blue-100 md:text-xs text-[10px] text-left">
            <p className="font-medium mb-1">Important:</p>
            <ul className="space-y-1 md:text-[11px] text-[10px]">
              <li>• Use the IBAN format for UAE bank accounts</li>
              <li>• Beneficiary name must match the account holder name</li>
              <li>• Payouts are processed within 1-2 business days</li>
            </ul>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {userRole !== USER_ROLES.MODEL && (
            <button
              onClick={handleClose}
              className="flex-1 cosmic-button-secondary"
              disabled={loading}
            >
              Cancel
            </button>
          )}
          {isConnected && (
            <button
              onClick={() => setShowRemoveConfirmation(true)}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium md:py-3 md:px-4 py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove Account
            </button>
          )}
          <button
            onClick={handleSaveBankAccount}
            disabled={loading || !beneficiary || !iban || !bank}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium md:py-3 md:px-4 py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : isConnected ? 'Update Account' : <>Connect<br/>Bank Account</>}
          </button>
        </div>
      </div>

      {/* Remove Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRemoveConfirmation}
        onClose={() => setShowRemoveConfirmation(false)}
        onConfirm={handleRemoveAccount}
        title="Remove Bank Account"
        message="Are you sure you want to remove this bank account?"
        confirmText="Remove Account"
        loading={removeLoading}
      >
        <div className="text-left bg-gray-800/50 rounded-lg p-3">
          <p className="text-white text-sm font-mono">
            {iban && bank ? `${iban.slice(0, 4)}••••${iban.slice(-4)} • ${bank}` : 'Bank Account'}
          </p>
        </div>
      </ConfirmationModal>
    </div>
  )
}