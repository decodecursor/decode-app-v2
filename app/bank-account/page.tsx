'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
import type { User } from '@supabase/supabase-js'

interface BankAccount {
  id: string
  beneficiary_name: string
  iban_number: string
  bank_name: string
  routing_number?: string
  is_primary: boolean
}

export default function BankAccountPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Form states
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [ibanNumber, setIbanNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')

  useEffect(() => {
    const getUser = async () => {
      try {
        const { user } = await getUserWithProxy()
        if (!user) {
          router.push('/auth')
          return
        }
        setUser(user)
        await loadBankAccount(user.id)
      } catch (error) {
        console.error('Authentication failed:', error)
        router.push('/auth')
      }
    }
    getUser()
  }, [])

  const loadBankAccount = async (userId: string) => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error loading bank account:', error)
      }

      if (data) {
        setBankAccount(data)
        setBeneficiaryName(data.beneficiary_name)
        setIbanNumber(data.iban_number)
        setBankName(data.bank_name)
        setRoutingNumber(data.routing_number || '')
      }
    } catch (error) {
      console.error('Error loading bank account:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return

    // Validation
    if (!beneficiaryName.trim() || !ibanNumber.trim() || !bankName.trim()) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setSaving(true)
      setError('')

      const bankAccountData = {
        user_id: user.id,
        beneficiary_name: beneficiaryName.trim(),
        iban_number: ibanNumber.trim(),
        bank_name: bankName.trim(),
        routing_number: routingNumber.trim() || null,
        is_primary: true,
        updated_at: new Date().toISOString()
      }

      if (bankAccount) {
        // Update existing
        const { error } = await supabase
          .from('user_bank_accounts')
          .update(bankAccountData)
          .eq('id', bankAccount.id)

        if (error) throw error
      } else {
        // Create new
        const { data, error } = await supabase
          .from('user_bank_accounts')
          .insert([{
            ...bankAccountData,
            created_at: new Date().toISOString()
          }])
          .select()
          .single()

        if (error) throw error
        setBankAccount(data)
      }

      setSuccessMessage('Bank account information saved successfully!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error: any) {
      console.error('Error saving bank account:', error)
      setError('Failed to save bank account information. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const maskIban = (iban: string) => {
    if (!iban || iban.length < 4) return iban
    return '••••' + iban.slice(-4)
  }

  return (
    <div className="cosmic-bg min-h-screen">
      <div className="min-h-screen px-4 py-8">
        {/* Back to Dashboard Button */}
        <div className="flex justify-center mb-8">
          <div style={{width: '70vw'}}>
            <Link
              href="/dashboard"
              className="inline-flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-center mb-6">
          <div style={{width: '70vw'}}>
            <div className="cosmic-card">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="cosmic-heading mb-2">Bank Account</h1>
                  <p className="text-gray-400">Manage your bank account information for payouts</p>
                </div>
                <div className="w-12 h-12 bg-gray-800/50 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="flex justify-center mb-6">
            <div style={{width: '70vw'}}>
              <div className="bg-green-600/20 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-green-100">{successMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex justify-center mb-6">
            <div style={{width: '70vw'}}>
              <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-red-100">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Bank Account Status */}
        {bankAccount && (
          <div className="flex justify-center mb-6">
            <div style={{width: '70vw'}}>
              <div className="cosmic-card">
                <h3 className="text-lg font-semibold text-white mb-4">Current Bank Account</h3>
                <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Account Holder:</span>
                    <span className="text-white">{bankAccount.beneficiary_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">IBAN:</span>
                    <span className="text-white">{maskIban(bankAccount.iban_number)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Bank:</span>
                    <span className="text-white">{bankAccount.bank_name}</span>
                  </div>
                  <div className="flex items-center mt-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                    <span className="text-green-400 text-sm">Connected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bank Account Form */}
        <div className="flex justify-center">
          <div style={{width: '70vw'}}>
            <div className="cosmic-card">
              <h3 className="text-lg font-semibold text-white mb-6">
                {bankAccount ? 'Update Bank Account Information' : 'Add Bank Account Information'}
              </h3>

              {loading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 w-32 bg-gray-700 rounded"></div>
                  <div className="h-10 bg-gray-700 rounded"></div>
                  <div className="h-4 w-32 bg-gray-700 rounded"></div>
                  <div className="h-10 bg-gray-700 rounded"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Account Holder Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Account Holder Name *
                    </label>
                    <input
                      type="text"
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter account holder name"
                      disabled={saving}
                    />
                  </div>

                  {/* IBAN Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      IBAN Number *
                    </label>
                    <input
                      type="text"
                      value={ibanNumber}
                      onChange={(e) => setIbanNumber(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="AE07 0331 2345 6789 0123 456"
                      disabled={saving}
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      Use the IBAN format for UAE bank accounts
                    </p>
                  </div>

                  {/* Bank Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Emirates NBD, ADCB, FAB, etc."
                      disabled={saving}
                    />
                  </div>

                  {/* Routing Number (Optional) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Routing Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={routingNumber}
                      onChange={(e) => setRoutingNumber(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter routing number if required"
                      disabled={saving}
                    />
                  </div>

                  {/* Important Notes */}
                  <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="text-blue-100 font-medium mb-2">Important Notes:</h4>
                    <ul className="text-blue-100 text-sm space-y-1">
                      <li>• Ensure all information is accurate to avoid payout delays</li>
                      <li>• Use the IBAN format for UAE bank accounts</li>
                      <li>• This account will be used for weekly payouts</li>
                      <li>• Contact support if you need help with your bank details</li>
                    </ul>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSave}
                    disabled={saving || !beneficiaryName || !ibanNumber || !bankName}
                    className="w-full cosmic-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </div>
                    ) : (
                      bankAccount ? 'Update Bank Account' : 'Save Bank Account'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}