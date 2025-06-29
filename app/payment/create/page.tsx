'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

export default function CreatePayment() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    amount: ''
  })
  const [errors, setErrors] = useState({
    title: '',
    amount: ''
  })
  const router = useRouter()

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
    const newErrors = { title: '', amount: '' }
    let isValid = true

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
        newErrors.amount = 'Please enter a valid amount greater than $0'
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

      // Save payment link to Supabase
      const { data, error: saveError } = await supabase
        .from('payment_links')
        .insert({
          title: formData.title.trim(),
          description: null,
          amount_usd: parseFloat(formData.amount),
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
      setSuccess(true)
      
      // Redirect to My Links page after 2 seconds
      setTimeout(() => {
        router.push('/my-links')
      }, 2000)

    } catch (error) {
      console.error('Error creating payment link:', error)
      setError(error instanceof Error ? error.message : 'Failed to create payment link')
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormData({ title: '', amount: '' })
    setErrors({ title: '', amount: '' })
    setSuccess(false)
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
          <div className="w-full" style={{maxWidth: '70vw'}}>
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
          {!success ? (
            /* Payment Form */
            <div className="cosmic-card">
              <h1 className="cosmic-heading text-center mb-8">Create Payment Link</h1>

              <form onSubmit={generatePaymentLink} className="space-y-6">
                <div>
                  <label className="cosmic-label block mb-2">Service *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g., Hair Styling, Makeup Session, Manicure"
                    className={`cosmic-input ${errors.title ? 'border-red-500' : ''}`}
                    disabled={creating}
                  />
                  {errors.title && (
                    <p className="mt-2 text-sm text-red-400">{errors.title}</p>
                  )}
                </div>

                <div>
                  <label className="cosmic-label block mb-2">Amount in USD *</label>
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
                    {creating ? 'Creating Payment Link...' : 'Create Payment Link'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Success State */
            <div className="cosmic-card text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h2 className="cosmic-heading mb-2">Payment Link Created!</h2>
                <p className="cosmic-body opacity-80 mb-4">
                  Your payment link has been saved to the database successfully.
                </p>
                <p className="cosmic-body text-purple-400">
                  Redirecting to My Links page...
                </p>
              </div>

              <div className="bg-black/20 rounded-lg p-4 mb-6">
                <div className="cosmic-label mb-2">Payment Details</div>
                <div className="cosmic-body mb-1">Service: <span className="font-medium">{formData.title}</span></div>
                <div className="cosmic-body">Amount: <span className="text-2xl font-medium">${formData.amount}</span></div>
                <div className="cosmic-body text-sm text-gray-400 mt-2">
                  Expires: {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={resetForm}
                  className="cosmic-button-primary flex-1"
                >
                  Create Another Link
                </button>
                <Link href="/my-links" className="cosmic-button-secondary flex-1 text-center py-3 border border-white/30 rounded-lg">
                  Go to My Links
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}