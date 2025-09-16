'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
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
  
  // Client suggestions states
  const [clientSuggestions, setClientSuggestions] = useState<Array<{name: string, count: number}>>([])
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)
  const [selectedClientSuggestionIndex, setSelectedClientSuggestionIndex] = useState(-1)
  const [isLoadingClientSuggestions, setIsLoadingClientSuggestions] = useState(false)
  
  // Service suggestions states
  const [serviceSuggestions, setServiceSuggestions] = useState<Array<{name: string, count: number}>>([])
  const [showServiceSuggestions, setShowServiceSuggestions] = useState(false)
  const [selectedServiceSuggestionIndex, setSelectedServiceSuggestionIndex] = useState(-1)
  const [isLoadingServiceSuggestions, setIsLoadingServiceSuggestions] = useState(false)
  
  // Branch management states
  const [userBranches, setUserBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [showBranchSelector, setShowBranchSelector] = useState(false)
  
  const router = useRouter()

  const ensureUserHasWallet = async (user: User) => {
    try {
      const supabase = createClient()
      
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

  // Fetch client suggestions
  useEffect(() => {
    const fetchClientSuggestions = async () => {
      if (formData.client.length >= 2) {
        setIsLoadingClientSuggestions(true)
        try {
          const response = await fetch(`/api/payment/client-suggestions?q=${encodeURIComponent(formData.client)}`)
          if (response.ok) {
            const data = await response.json()
            setClientSuggestions(data.suggestions || [])
            setShowClientSuggestions(data.suggestions && data.suggestions.length > 0)
          } else {
            setClientSuggestions([])
            setShowClientSuggestions(false)
          }
        } catch (error) {
          console.error('Error fetching client suggestions:', error)
          setClientSuggestions([])
          setShowClientSuggestions(false)
        } finally {
          setIsLoadingClientSuggestions(false)
        }
      } else {
        setClientSuggestions([])
        setShowClientSuggestions(false)
      }
    }

    const debounceTimer = setTimeout(fetchClientSuggestions, 300)
    return () => clearTimeout(debounceTimer)
  }, [formData.client])

  // Fetch service suggestions
  useEffect(() => {
    const fetchServiceSuggestions = async () => {
      if (formData.title.length >= 2) {
        setIsLoadingServiceSuggestions(true)
        try {
          const response = await fetch(`/api/payment/service-suggestions?q=${encodeURIComponent(formData.title)}`)
          if (response.ok) {
            const data = await response.json()
            setServiceSuggestions(data.suggestions || [])
            setShowServiceSuggestions(data.suggestions && data.suggestions.length > 0)
          } else {
            setServiceSuggestions([])
            setShowServiceSuggestions(false)
          }
        } catch (error) {
          console.error('Error fetching service suggestions:', error)
          setServiceSuggestions([])
          setShowServiceSuggestions(false)
        } finally {
          setIsLoadingServiceSuggestions(false)
        }
      } else {
        setServiceSuggestions([])
        setShowServiceSuggestions(false)
      }
    }

    const debounceTimer = setTimeout(fetchServiceSuggestions, 300)
    return () => clearTimeout(debounceTimer)
  }, [formData.title])

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.client-input-wrapper')) {
        setShowClientSuggestions(false)
        setSelectedClientSuggestionIndex(-1)
      }
      if (!target.closest('.service-input-wrapper')) {
        setShowServiceSuggestions(false)
        setSelectedServiceSuggestionIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const loadUserData = async () => {
      const { user } = await getUserWithProxy()
      if (!user) {
        router.push('/auth')
        return
      }
      setUser(user)

      try {
        const response = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include'
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Failed to fetch profile:', errorData.error)
          setUserBranches([])
          setSelectedBranch('')
          return
        }

        const { userData } = await response.json()

        // Set user branch data (copy dashboard logic exactly)
        if (userData?.branch_name) {
          const branches = userData.branch_name.split(',').map((b: string) => b.trim()).filter((b: string) => b !== '')
          setUserBranches(branches)
          setSelectedBranch(branches[0] || '')
        } else {
          setUserBranches([])
          setSelectedBranch('')
        }

      } catch (error) {
        console.error('Error loading user data:', error)
        setUserBranches([])
        setSelectedBranch('')
      }

      setLoading(false)
    }

    loadUserData()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear errors when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    
    // Reset suggestion selection when typing
    if (name === 'client') {
      setSelectedClientSuggestionIndex(-1)
    } else if (name === 'title') {
      setSelectedServiceSuggestionIndex(-1)
    }
  }

  const handleClientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showClientSuggestions || clientSuggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedClientSuggestionIndex(prev => 
          prev < clientSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedClientSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        if (selectedClientSuggestionIndex >= 0) {
          e.preventDefault()
          selectClientSuggestion(clientSuggestions[selectedClientSuggestionIndex].name)
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowClientSuggestions(false)
        setSelectedClientSuggestionIndex(-1)
        break
    }
  }

  const selectClientSuggestion = (clientName: string) => {
    setFormData(prev => ({ ...prev, client: clientName }))
    setShowClientSuggestions(false)
    setSelectedClientSuggestionIndex(-1)
    // Clear error if there was one
    if (errors.client) {
      setErrors(prev => ({ ...prev, client: '' }))
    }
  }

  const handleServiceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showServiceSuggestions || serviceSuggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedServiceSuggestionIndex(prev => 
          prev < serviceSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedServiceSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        if (selectedServiceSuggestionIndex >= 0) {
          e.preventDefault()
          selectServiceSuggestion(serviceSuggestions[selectedServiceSuggestionIndex].name)
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowServiceSuggestions(false)
        setSelectedServiceSuggestionIndex(-1)
        break
    }
  }

  const selectServiceSuggestion = (serviceName: string) => {
    setFormData(prev => ({ ...prev, title: serviceName }))
    setShowServiceSuggestions(false)
    setSelectedServiceSuggestionIndex(-1)
    // Clear error if there was one
    if (errors.title) {
      setErrors(prev => ({ ...prev, title: '' }))
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

    // Check if user has any branch assignments
    if (userBranches.length === 0) {
      setError('You are not assigned to any branch. Please contact your administrator to get branch access before creating payment links.')
      return
    }

    // Check if selected branch is still valid (in case of real-time removal)
    if (selectedBranch && !userBranches.includes(selectedBranch)) {
      setError('The selected branch is no longer available. Please refresh the page and try again.')
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
              <div className="client-input-wrapper relative">
                <label className="cosmic-label block mb-2">Client</label>
                <input
                  type="text"
                  name="client"
                  value={formData.client}
                  onChange={handleInputChange}
                  onKeyDown={handleClientKeyDown}
                  onFocus={() => {
                    if (clientSuggestions.length > 0) {
                      setShowClientSuggestions(true)
                    }
                  }}
                  placeholder="Sarah Johnson"
                  className={`cosmic-input ${errors.client ? 'border-red-500' : ''}`}
                  disabled={creating}
                  autoComplete="off"
                />
                
                {/* Client Suggestions Dropdown */}
                {showClientSuggestions && clientSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-purple-500/50 rounded-lg shadow-2xl overflow-hidden">
                    {clientSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.name}
                        onClick={() => selectClientSuggestion(suggestion.name)}
                        onMouseEnter={() => setSelectedClientSuggestionIndex(index)}
                        className={`px-4 py-3 cursor-pointer flex justify-between items-center transition-all ${
                          index === selectedClientSuggestionIndex
                            ? 'bg-purple-600/30 text-white'
                            : 'hover:bg-purple-600/20 text-gray-300 hover:text-white'
                        }`}
                      >
                        <span className="font-medium">{suggestion.name}</span>
                        <span className="text-xs text-purple-400">
                          Used {suggestion.count} times
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {errors.client && (
                  <p className="mt-2 text-sm text-red-400">{errors.client}</p>
                )}
              </div>

              <div className="service-input-wrapper relative">
                <label className="cosmic-label block mb-2">Service</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  onKeyDown={handleServiceKeyDown}
                  onFocus={() => {
                    if (serviceSuggestions.length > 0) {
                      setShowServiceSuggestions(true)
                    }
                  }}
                  placeholder="Haircut"
                  className={`cosmic-input ${errors.title ? 'border-red-500' : ''}`}
                  disabled={creating}
                  autoComplete="off"
                />
                
                {/* Service Suggestions Dropdown */}
                {showServiceSuggestions && serviceSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-purple-500/50 rounded-lg shadow-2xl overflow-hidden">
                    {serviceSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.name}
                        onClick={() => selectServiceSuggestion(suggestion.name)}
                        onMouseEnter={() => setSelectedServiceSuggestionIndex(index)}
                        className={`px-4 py-3 cursor-pointer flex justify-between items-center transition-all ${
                          index === selectedServiceSuggestionIndex
                            ? 'bg-purple-600/30 text-white'
                            : 'hover:bg-purple-600/20 text-gray-300 hover:text-white'
                        }`}
                      >
                        <span className="font-medium">{suggestion.name}</span>
                        <span className="text-xs text-purple-400">
                          Used {suggestion.count} times
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
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
                  disabled={creating || userBranches.length === 0}
                  className="bg-gradient-to-br from-gray-800 to-black text-white border-none rounded-lg text-[17px] font-medium px-6 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-gray-600 hover:to-gray-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {creating ? 'Creating PayLink...' :
                   userBranches.length === 0 ? 'No Branch Access' :
                   'Create PayLink'}
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
                ) : userBranches.length === 1 ? (
                  <div className="text-sm text-gray-300">
                    Branch: <span className="text-purple-400">{selectedBranch}</span>
                  </div>
                ) : (
                  <div className="text-sm text-red-400">
                    ⚠️ No branch assigned - Contact administrator
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