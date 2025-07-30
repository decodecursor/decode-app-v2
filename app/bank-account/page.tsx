'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface BankAccount {
  id: string
  bank_name: string
  account_holder_name: string
  account_number: string
  routing_number?: string
  iban?: string
  swift_code?: string
  is_verified: boolean
  is_primary: boolean
  status: 'pending' | 'verified' | 'rejected' | 'suspended'
  verification_method?: string
  verified_at?: string
  created_at: string
}

interface BankAccountForm {
  bank_name: string
  account_holder_name: string
  account_number: string
  routing_number: string
  iban: string
  swift_code: string
  account_type: 'domestic' | 'international'
}

export default function BankAccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState<BankAccountForm>({
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    routing_number: '',
    iban: '',
    swift_code: '',
    account_type: 'domestic'
  })

  // Feedback states
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      setUser(user)
      await fetchBankAccounts(user.id)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/auth')
    } finally {
      setLoading(false)
    }
  }

  const fetchBankAccounts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setBankAccounts(data || [])
      
      // Show form if no bank accounts exist
      if (!data || data.length === 0) {
        setShowForm(true)
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error)
      setMessage({ type: 'error', text: 'Failed to load bank accounts' })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = (): string | null => {
    if (!formData.bank_name.trim()) return 'Bank name is required'
    if (!formData.account_holder_name.trim()) return 'Account holder name is required'
    if (!formData.account_number.trim()) return 'Account number is required'
    
    if (formData.account_type === 'domestic') {
      if (!formData.routing_number.trim()) return 'Routing number is required for domestic accounts'
    } else {
      if (!formData.iban.trim() && !formData.swift_code.trim()) {
        return 'Either IBAN or SWIFT code is required for international accounts'
      }
    }
    
    return null
  }

  const submitBankAccount = async () => {
    const validationError = validateForm()
    if (validationError) {
      setMessage({ type: 'error', text: validationError })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/bank-account/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          is_primary: bankAccounts.length === 0 // First account is primary
        })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      await fetchBankAccounts(user.id)
      setShowForm(false)
      setFormData({
        bank_name: '',
        account_holder_name: '',
        account_number: '',
        routing_number: '',
        iban: '',
        swift_code: '',
        account_type: 'domestic'
      })
      setMessage({ type: 'success', text: 'Bank account added successfully. Verification process initiated.' })
    } catch (error) {
      console.error('Error adding bank account:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to add bank account' })
    } finally {
      setSaving(false)
    }
  }

  const setPrimaryAccount = async (accountId: string) => {
    try {
      const response = await fetch('/api/bank-account/set-primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      await fetchBankAccounts(user.id)
      setMessage({ type: 'success', text: 'Primary account updated successfully' })
    } catch (error) {
      console.error('Error setting primary account:', error)
      setMessage({ type: 'error', text: 'Failed to update primary account' })
    }
  }

  const removeAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this bank account?')) return

    try {
      const response = await fetch('/api/bank-account/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      await fetchBankAccounts(user.id)
      setMessage({ type: 'success', text: 'Bank account removed successfully' })
    } catch (error) {
      console.error('Error removing bank account:', error)
      setMessage({ type: 'error', text: 'Failed to remove bank account' })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'text-green-400'
      case 'pending': return 'text-yellow-400'
      case 'rejected': return 'text-red-400'
      case 'suspended': return 'text-orange-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      case 'pending':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      case 'rejected':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      default:
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading bank accounts...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center text-gray-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white">Bank Account Management</h1>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-600/20 text-green-100 border border-green-500/30' : 
            'bg-red-600/20 text-red-100 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Existing Bank Accounts */}
        {bankAccounts.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Your Bank Accounts</h2>
              <button
                onClick={() => setShowForm(true)}
                className="cosmic-button-primary"
              >
                Add New Account
              </button>
            </div>

            <div className="grid gap-6">
              {bankAccounts.map((account) => (
                <div key={account.id} className="cosmic-card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="text-lg font-semibold text-white">{account.bank_name}</h3>
                        {account.is_primary && (
                          <span className="px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                            Primary
                          </span>
                        )}
                        <div className={`flex items-center space-x-1 ${getStatusColor(account.status)}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {getStatusIcon(account.status)}
                          </svg>
                          <span className="text-sm capitalize">{account.status}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Account Holder:</span>
                          <span className="ml-2 text-white">{account.account_holder_name}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Account Number:</span>
                          <span className="ml-2 text-white">****{account.account_number.slice(-4)}</span>
                        </div>
                        {account.routing_number && (
                          <div>
                            <span className="text-gray-400">Routing Number:</span>
                            <span className="ml-2 text-white">{account.routing_number}</span>
                          </div>
                        )}
                        {account.iban && (
                          <div>
                            <span className="text-gray-400">IBAN:</span>
                            <span className="ml-2 text-white">{account.iban}</span>
                          </div>
                        )}
                        {account.swift_code && (
                          <div>
                            <span className="text-gray-400">SWIFT Code:</span>
                            <span className="ml-2 text-white">{account.swift_code}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400">Added:</span>
                          <span className="ml-2 text-white">
                            {new Date(account.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      {!account.is_primary && account.status === 'verified' && (
                        <button
                          onClick={() => setPrimaryAccount(account.id)}
                          className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                        >
                          Make Primary
                        </button>
                      )}
                      <button
                        onClick={() => removeAccount(account.id)}
                        className="text-red-400 hover:text-red-300 text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Bank Account Form */}
        {showForm && (
          <div className="cosmic-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Add Bank Account</h2>
              {bankAccounts.length > 0 && (
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account Type Selection */}
              <div className="md:col-span-2">
                <label className="block text-gray-300 mb-2">Account Type</label>
                <select
                  name="account_type"
                  value={formData.account_type}
                  onChange={handleInputChange}
                  className="cosmic-input"
                >
                  <option value="domestic">Domestic Account</option>
                  <option value="international">International Account</option>
                </select>
              </div>

              {/* Basic Information */}
              <div>
                <label className="block text-gray-300 mb-2">Bank Name *</label>
                <input
                  type="text"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleInputChange}
                  placeholder="Enter bank name"
                  className="cosmic-input"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Account Holder Name *</label>
                <input
                  type="text"
                  name="account_holder_name"
                  value={formData.account_holder_name}
                  onChange={handleInputChange}
                  placeholder="Full name as on account"
                  className="cosmic-input"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Account Number *</label>
                <input
                  type="text"
                  name="account_number"
                  value={formData.account_number}
                  onChange={handleInputChange}
                  placeholder="Enter account number"
                  className="cosmic-input"
                />
              </div>

              {/* Conditional Fields */}
              {formData.account_type === 'domestic' ? (
                <div>
                  <label className="block text-gray-300 mb-2">Routing Number *</label>
                  <input
                    type="text"
                    name="routing_number"
                    value={formData.routing_number}
                    onChange={handleInputChange}
                    placeholder="Enter routing number"
                    className="cosmic-input"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-gray-300 mb-2">IBAN</label>
                    <input
                      type="text"
                      name="iban"
                      value={formData.iban}
                      onChange={handleInputChange}
                      placeholder="Enter IBAN"
                      className="cosmic-input"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2">SWIFT Code</label>
                    <input
                      type="text"
                      name="swift_code"
                      value={formData.swift_code}
                      onChange={handleInputChange}
                      placeholder="Enter SWIFT code"
                      className="cosmic-input"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-4">
              {bankAccounts.length > 0 && (
                <button
                  onClick={() => setShowForm(false)}
                  className="cosmic-button-secondary"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={submitBankAccount}
                disabled={saving}
                className="cosmic-button-primary disabled:opacity-50"
              >
                {saving ? 'Adding Account...' : 'Add Bank Account'}
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {bankAccounts.length === 0 && !showForm && (
          <div className="cosmic-card text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <h3 className="text-xl font-semibold text-white mb-2">No Bank Accounts</h3>
            <p className="text-gray-400 mb-6">Add a bank account to receive payments and transfers</p>
            <button
              onClick={() => setShowForm(true)}
              className="cosmic-button-primary"
            >
              Add Your First Bank Account
            </button>
          </div>
        )}
      </div>
    </div>
  )
}