'use client'

import { useState, useEffect } from 'react'
import { ConfirmationModal } from './ConfirmationModal'
import { USER_ROLES } from '@/types/user'

interface PayPalModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  onSuccess: () => void
  userRole?: string
  onMethodDeleted?: () => void
}

export function PayPalModal({ isOpen, onClose, userId, onSuccess, userRole, onMethodDeleted }: PayPalModalProps) {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false)
  const [removeLoading, setRemoveLoading] = useState(false)

  // Load existing PayPal account data when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      loadExistingPayPalAccount()
    }
  }, [isOpen, userId])

  const loadExistingPayPalAccount = async () => {
    try {
      const response = await fetch('/api/user/paypal-account', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          const paypalAccount = result.data
          setEmail(paypalAccount.email || '')
          setConfirmEmail(paypalAccount.email || '')
          setIsConnected(true)
        }
      }
    } catch (error) {
      console.error('Error loading existing PayPal account:', error)
    }
  }

  if (!isOpen) return null

  const handleSavePayPal = async () => {
    if (!email.trim() || !confirmEmail.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    if (email !== confirmEmail) {
      setMessage({ type: 'error', text: 'Email addresses do not match' })
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const method = isConnected ? 'PUT' : 'POST'
      const response = await fetch('/api/user/paypal-account', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim(),
          confirm_email: confirmEmail.trim()
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage({ type: 'success', text: result.message || 'PayPal account saved successfully!' })
        setIsConnected(true)

        // Call success callback and close modal after a brief delay
        setTimeout(() => {
          onSuccess()
          onClose()
          setMessage(null)
        }, 1500)
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to save PayPal account'
        })
      }

    } catch (error) {
      console.error('Error saving PayPal account:', error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to connect PayPal account'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!isConnected) {
      setEmail('')
      setConfirmEmail('')
    }
    setMessage(null)
    setShowRemoveConfirmation(false)
    onClose()
  }

  const handleRemoveAccount = async () => {
    setRemoveLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user/paypal-account', {
        method: 'DELETE',
        credentials: 'include'
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setMessage({
          type: 'success',
          text: 'PayPal account removed successfully!'
        })

        // Reset form state
        setEmail('')
        setConfirmEmail('')
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
          text: result.error || 'Failed to remove PayPal account'
        })
        setShowRemoveConfirmation(false)
      }
    } catch (error) {
      console.error('Error removing PayPal account:', error)
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
            {userRole === USER_ROLES.STAFF || userRole === USER_ROLES.MODEL ? 'Add Your PayPal Account' : 'Add Company PayPal Account'}
          </h2>
          <p className="text-gray-400 md:text-sm text-xs">
            {userRole === USER_ROLES.STAFF || userRole === USER_ROLES.MODEL ? 'Connect your PayPal account to receive payouts' : 'Connect company PayPal account to receive payouts'}
          </p>
        </div>

        {/* Message Display - Only show errors */}
        {message && message.type === 'error' && (
          <div className="mb-6 p-4 rounded-lg bg-red-600/20 text-red-100 border border-red-500/30">
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
              PayPal Account Connected
            </div>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              PayPal Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full md:px-4 md:py-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Confirm Email Address
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="email@example.com"
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
              <li>• Use the PayPal account email address</li>
              <li>• PayPal account must be verified to receive payouts</li>
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
            onClick={handleSavePayPal}
            disabled={loading || !email || !confirmEmail}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium md:py-3 md:px-4 py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : isConnected ? 'Update PayPal' : 'Connect PayPal'}
          </button>
        </div>
      </div>

      {/* Remove Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRemoveConfirmation}
        onClose={() => setShowRemoveConfirmation(false)}
        onConfirm={handleRemoveAccount}
        title="Remove PayPal Account"
        message="Are you sure you want to remove this PayPal account?"
        confirmText="Remove Account"
        loading={removeLoading}
      >
        <div className="text-left bg-gray-800/50 rounded-lg p-3">
          <p className="text-white text-sm font-mono">
            {email ? email : 'PayPal Account'}
          </p>
        </div>
      </ConfirmationModal>
    </div>
  )
}