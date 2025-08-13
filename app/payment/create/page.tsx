'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { calculateMarketplaceFee } from '@/types/crossmint'

export default function CreatePayment() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
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
  
  // Branch management states
  const [userBranches, setUserBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [showBranchSelector, setShowBranchSelector] = useState(false)
  
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
      
      // Fetch user's branch information
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('branch_name')
          .eq('id', user.id)
          .single()
        
        if (error) {
          console.error('Error fetching user branches:', error)
        } else if (userData?.branch_name) {
          const branches = userData.branch_name.split(',').map(b => b.trim()).filter(b => b !== '')
          setUserBranches(branches)
          setSelectedBranch(branches[0] || 'Downtown Branch') // Default to first branch
        } else {
          // Default to Downtown Branch if no branch assigned
          setUserBranches(['Downtown Branch'])
          setSelectedBranch('Downtown Branch')
        }
      } catch (error) {
        console.error('Error fetching branches:', error)
        // Fallback to default branch
        setUserBranches(['Downtown Branch'])
        setSelectedBranch('Downtown Branch')
      }
      
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

      // Wallet creation removed - not needed for beauty business
      // await ensureUserHasWallet(user)

      // Create payment link using proper API endpoint
      const response = await fetch('/api/payment/create-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_name: formData.client.trim(),
          title: formData.title.trim(),
          description: `Beauty service: ${formData.title.trim()}`,
          original_amount_aed: originalAmount,
          creator_id: user.id,
          branch_name: selectedBranch
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment link');
      }

      const result = await response.json();
      const data = result.data.paymentLink;

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

  // Loading state removed - show content immediately

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen px-4 py-8">
        {/* Back to Dashboard Link */}
        <div className="flex justify-center mb-8">
          <div className="w-full" style={{maxWidth: '30vw'}}>
          <Link 
            href="/dashboard" 
            className="inline-flex items-center text-gray-300 hover:text-white transition-colors payment-back-button"
            onClick={(e) => {
              console.log('Back to Dashboard clicked from payment create page');
              e.preventDefault();
              window.location.href = '/dashboard';
            }}
          >
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
                <label className="cosmic-label block mb-2">Client</label>
                <input
                  type="text"
                  name="client"
                  value={formData.client}
                  onChange={handleInputChange}
                  placeholder="Sarah Johnson"
                  className={`cosmic-input ${errors.client ? 'border-red-500' : ''}`}
                  disabled={creating}
                />
                {errors.client && (
                  <p className="mt-2 text-sm text-red-400">{errors.client}</p>
                )}
              </div>

              <div>
                <label className="cosmic-label block mb-2">Service</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Haircut"
                  className={`cosmic-input ${errors.title ? 'border-red-500' : ''}`}
                  disabled={creating}
                />
                {errors.title && (
                  <p className="mt-2 text-sm text-red-400">{errors.title}</p>
                )}
              </div>

              <div>
                <label className="cosmic-label block mb-2">Amount in AED</label>
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
                  className="bg-gradient-to-br from-gray-800 to-black text-white border-none rounded-lg text-[17px] font-medium px-6 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-gray-600 hover:to-gray-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {creating ? 'Creating PayLink...' : 'Create PayLink'}
                </button>
              </div>

              {/* Branch Information */}
              <div className="-mt-8 text-center">
                {userBranches.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setShowBranchSelector(true)}
                    className="text-sm text-gray-300 hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto"
                  >
                    <span>{selectedBranch}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                ) : (
                  <div className="text-sm text-gray-300">
                    {selectedBranch}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Branch Selection Modal */}
      {showBranchSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="cosmic-card max-w-md w-full">
            <h3 className="cosmic-heading mb-4 text-white">Select Branch</h3>
            <p className="text-gray-300 text-sm mb-4">
              Choose which branch this payment link is for:
            </p>
            
            <div className="space-y-2 mb-6">
              {userBranches.map((branch) => (
                <button
                  key={branch}
                  onClick={() => {
                    setSelectedBranch(branch)
                    setShowBranchSelector(false)
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedBranch === branch
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {branch}
                  {selectedBranch === branch && (
                    <svg className="w-4 h-4 float-right mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowBranchSelector(false)}
                className="cosmic-button-secondary px-6 py-2 border border-white/30 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}