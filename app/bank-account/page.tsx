'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function BankAccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  // Form fields for simplified bank account entry
  const [beneficiary, setBeneficiary] = useState('')
  const [iban, setIban] = useState('')
  const [bank, setBank] = useState('')
  
  // Track saved values for comparison
  const [savedBeneficiary, setSavedBeneficiary] = useState('')
  const [savedIban, setSavedIban] = useState('')
  const [savedBank, setSavedBank] = useState('')

  const handleSaveBankAccount = async () => {
    if (!beneficiary.trim() || !iban.trim() || !bank.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields' })
      return
    }

    if (!user?.id) {
      setMessage({ type: 'error', text: 'User not authenticated' })
      return
    }

    setLoading(true)
    
    try {
      // Try to insert into user_bank_account table
      const { error } = await supabase
        .from('user_bank_account')
        .insert({
          user_id: user.id,
          beneficiary_name: beneficiary.trim(),
          iban_number: iban.trim(),
          bank_name: bank.trim(),
          is_primary: true,
          status: 'pending'
        })

      if (error) {
        // If table doesn't exist, show a helpful message
        if (error.message.includes('relation "user_bank_account" does not exist')) {
          setMessage({ 
            type: 'error', 
            text: 'Bank account table not set up yet. Please contact support to enable this feature.' 
          })
          return
        }
        console.error('Supabase insert error:', error)
        throw error
      }
      
      setIsConnected(true)
      setMessage({ type: 'success', text: 'Bank account saved successfully!' })
      
      // Update saved values to current form values
      setSavedBeneficiary(beneficiary.trim())
      setSavedIban(iban.trim())
      setSavedBank(bank.trim())
      
    } catch (error) {
      console.error('Error saving bank account:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save bank account' 
      })
    } finally {
      setLoading(false)
    }
  }

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
      await loadAccountData(user.id)
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/auth')
    }
  }

  const loadAccountData = async (userId: string) => {
    try {
      // Fetch user data including role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', userId)
        .single()

      if (userError) {
        console.error('🔴 Database error:', userError.message)
        setMessage({ type: 'error', text: `Database error: ${userError.message}` })
        setLoading(false)
        return
      }

      if (userData) {
        // Set user role
        setUserRole(userData.role)
        
        // Try to load existing bank account data
        try {
          const { data: bankAccounts, error: bankError } = await supabase
            .from('user_bank_account')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
          
          // If table doesn't exist, just continue without data
          if (bankError && bankError.message.includes('relation "user_bank_account" does not exist')) {
            console.log('Bank accounts table not yet created - showing empty form')
          } else if (bankError) {
            console.error('Error loading bank accounts:', bankError)
          } else if (bankAccounts && bankAccounts.length > 0) {
            const account = bankAccounts[0]
            if (account) {
              // Populate form fields with saved data
              setBeneficiary(account.beneficiary_name || '')
              setIban(account.iban_number || '')
              setBank(account.bank_name || '')
              
              // Update saved values for comparison
              setSavedBeneficiary(account.beneficiary_name || '')
              setSavedIban(account.iban_number || '')
              setSavedBank(account.bank_name || '')
              
              // Set connected status
              setIsConnected(true)
            }
          }
        } catch (error) {
          console.error('Error loading bank account data:', error)
          // Continue without bank account data
        }
        
        setLoading(false)
        return
      }
    } catch (error) {
      console.error('Error loading account data:', error)
      setMessage({ type: 'error', text: 'Failed to load account information' })
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-300">Loading bank account information...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg min-h-screen">
      <div className="container mx-auto px-4 py-8">

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-600/20 text-green-100 border border-green-500/30' : 
            message.type === 'error' ? 'bg-red-600/20 text-red-100 border border-red-500/30' :
            'bg-blue-600/20 text-blue-100 border border-blue-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-6 flex justify-center">
          <div className="max-w-md w-full">
            {/* Back to Dashboard Link */}
            <div className="mb-6">
              <Link
                href="/dashboard"
                className="flex items-center text-gray-300 hover:text-white transition-colors w-fit"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
            
            {/* Bank Account Form */}
            <div className="cosmic-card text-center py-12 max-w-md w-full">
            
            <h2 className="text-2xl font-bold text-white mb-8">
              {userRole === 'User' ? 'Add Your Personal Bank Account' : 'Add Company Bank Account'}
            </h2>
            
            <div className="w-24 h-24 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            
            <div className="space-y-4 text-left mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Beneficiary
                </label>
                <input
                  type="text"
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  placeholder={userRole === 'User' ? 'John Smith' : 'Boho Beauty Salon'}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">IBAN</label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="AE 0700 3001 2769 3138 2000 1"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Bank</label>
                <input
                  type="text"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  placeholder="RAK Bank"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
            </div>
            
            {isConnected && (
              <div className="mb-6">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-600/20 text-green-400 border border-green-500/30">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Added Successfully
                </div>
              </div>
            )}
            
            <button
              onClick={handleSaveBankAccount}
              disabled={loading || (!beneficiary.trim() || !iban.trim() || !bank.trim() || 
                (beneficiary.trim() === savedBeneficiary && iban.trim() === savedIban && bank.trim() === savedBank))}
              className="cosmic-button-primary disabled:opacity-50 w-full"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}