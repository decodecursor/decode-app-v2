'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { calculateMarketplaceFee } from '@/types/crossmint'

export default function CreatePayment() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    client: '',
    title: '',
    amount: ''
  })
  const [errors, setErrors] = useState({
    client: '',
    title: '',
    amount: ''
  })
  const router = useRouter()

  const ensureUserHasWallet = async (user: User) => {
    try {
      // Check if user already has a wallet
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('wallet_address, crossmint_wallet_id')
        .eq('id', user.id)
        .single()

      if (userError) {
        console.error('Error checking user wallet:', userError)
        return // Don't fail payment link creation if wallet check fails
      }

      // If user already has a wallet, return early
      if (userData?.wallet_address) {
        console.log('✅ User already has wallet:', userData.wallet_address)
        return
      }

      // Create wallet for user
      console.log('🔄 Creating wallet for user automatically...')
      const response = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email
        })
      })

      const walletData = await response.json()

      if (response.ok && walletData.success) {
        console.log('✅ Wallet created automatically for payment link creation')
      } else {
        console.warn('⚠️ Failed to create wallet automatically, continuing with payment link creation')
      }
    } catch (error) {
      console.error('❌ Error ensuring user has wallet:', error)
      // Don't fail payment link creation if wallet creation fails
    }
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }
      setUser(user)
      setLoading(false)
    }

    getUser()
  }, [router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear errors when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors = { client: '', title: '', amount: '' }
    let isValid = true

    if (!formData.client.trim()) {
      newErrors.client = 'Client name is required'
      isValid = false
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Service title is required'
      isValid = false
    }

    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required'
      isValid = false
    } else {
      const amount = parseFloat(formData.amount)
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = 'Please enter a valid amount greater than AED 0'
        isValid = false
      }
    }

    setErrors(newErrors)
    return isValid
  }

  const generatePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    if (!user) {
      setError('User not authenticated')
      return
    }

    setCreating(true)
    setError('')

    try {
      // Calculate expiration date (7 days from now)
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() + 7)

      // Calculate marketplace fees
      const originalAmount = parseFloat(formData.amount)
      const feeCalculation = calculateMarketplaceFee(originalAmount)

      // Ensure wallet exists before creating payment link
      await ensureUserHasWallet(user)

      // Save payment link to Supabase (compatible with current schema)
      const { data, error: saveError } = await supabase
        .from('payment_links')
        .insert({
          client_name: formData.client.trim(),
          title: formData.title.trim(),
          description: `Service: ${formData.title.trim()} | Original: AED ${feeCalculation.originalAmount} | Fee: AED ${feeCalculation.feeAmount} | Total: AED ${feeCalculation.totalAmount}`,
          amount_aed: feeCalculation.totalAmount, // Store total amount (what customer pays)
          expiration_date: expirationDate.toISOString(),
          creator_id: user.id,
          is_active: true
        })
        .select()
        .single()

      if (saveError) {
        throw saveError
      }

      console.log('Payment link created successfully:', data)
      
      // Redirect immediately to My Links page with new PayLink ID for highlighting
      router.push(`/my-links?new=${data.id}`)

    } catch (error) {
      console.error('Error creating payment link:', error)
      setError(error instanceof Error ? error.message : 'Failed to create payment link')
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormData({ client: '', title: '', amount: '' })
    setErrors({ client: '', title: '', amount: '' })
    setError('')
  }

  if (loading) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card text-center">
            <div className="cosmic-body">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen px-4 py-8">
        {/* Back to Dashboard Link */}
        <div className="flex justify-center mb-8">
          <div className="w-full" style={{maxWidth: '30vw'}}>
          <Link href="/dashboard" className="inline-flex items-center text-gray-300 hover:text-white transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex justify-center">
          <div className="cosmic-card" style={{width: '30vw'}}>
            <h1 className="cosmic-heading text-center mb-8">Create PayLink</h1>

            <form onSubmit={generatePaymentLink} className="space-y-6">
              <div>
                <label className="cosmic-label block mb-2">Client *</label>
                <input
                  type="text"
                  name="client"
                  value={formData.client}
                  onChange={handleInputChange}
                  placeholder="e.g., Sarah Johnson"
                  className={`cosmic-input ${errors.client ? 'border-red-500' : ''}`}
                  disabled={creating}
                />
                {errors.client && (
                  <p className="mt-2 text-sm text-red-400">{errors.client}</p>
                )}
              </div>

              <div>
                <label className="cosmic-label block mb-2">Service *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Haircut"
                  className={`cosmic-input ${errors.title ? 'border-red-500' : ''}`}
                  disabled={creating}
                />
                {errors.title && (
                  <p className="mt-2 text-sm text-red-400">{errors.title}</p>
                )}
              </div>

              <div>
                <label className="cosmic-label block mb-2">Amount in AED *</label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className={`cosmic-input text-xl ${errors.amount ? 'border-red-500' : ''}`}
                  disabled={creating}
                />
                {errors.amount && (
                  <p className="mt-2 text-sm text-red-400">{errors.amount}</p>
                )}
                
                {/* Fee Calculation Display */}
                {formData.amount && !isNaN(parseFloat(formData.amount)) && parseFloat(formData.amount) > 0 && (
                  <div className="mt-4 p-4 bg-gray-800/50 rounded-lg space-y-2">
                    <h4 className="text-sm font-medium text-gray-300">Payment Breakdown</h4>
                    {(() => {
                      const amount = parseFloat(formData.amount)
                      const feeCalc = calculateMarketplaceFee(amount)
                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Service Amount:</span>
                            <span className="text-white">AED {feeCalc.originalAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Marketplace Fee (11%):</span>
                            <span className="text-yellow-400">AED {feeCalc.feeAmount.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-gray-600 pt-2">
                            <div className="flex justify-between text-base font-semibold">
                              <span className="text-white">Customer Pays:</span>
                              <span className="text-green-400">AED {feeCalc.totalAmount.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            * You receive AED {feeCalc.originalAmount.toFixed(2)} after the 11% marketplace fee
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              {error && (
                <div className="text-center p-3 rounded-lg text-sm text-red-300 bg-red-900/20">
                  {error}
                </div>
              )}

              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={creating}
                  className="cosmic-button-primary px-8 py-4 text-lg font-medium"
                >
                  {creating ? 'Creating PayLink...' : 'Create PayLink'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}