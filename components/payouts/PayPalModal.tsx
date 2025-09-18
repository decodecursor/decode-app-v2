'use client'

import { useState, useEffect } from 'react'

interface PayPalModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  onSuccess: () => void
}

export function PayPalModal({ isOpen, onClose, userId, onSuccess }: PayPalModalProps) {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
            <div className="w-8 h-8 text-blue-400 font-bold text-lg flex items-center justify-center">
              P
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect PayPal Account</h2>
          <p className="text-gray-400 text-sm">Add your PayPal email to receive payouts</p>
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
              placeholder="your.email@example.com"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
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
              placeholder="your.email@example.com"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
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
                <li>• Use the email address associated with your PayPal account</li>
                <li>• Your PayPal account must be verified to receive payouts</li>
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
            onClick={handleSavePayPal}
            disabled={loading || !email || !confirmEmail}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : isConnected ? 'Update PayPal' : 'Connect PayPal'}
          </button>
        </div>
      </div>
    </div>
  )
}