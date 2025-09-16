'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getUserWithProxy } from '@/utils/auth-helper'
import { PayoutHistory } from '@/components/stripe/PayoutHistory'
import { PayoutMethodsCard } from '@/components/payouts/PayoutMethodsCard'
import type { User } from '@supabase/supabase-js'

interface PayoutSummary {
  availableBalance: number
  pendingBalance: number
  totalEarnings: number
  lastPayoutAmount: number
  lastPayoutDate: string | null
  bankConnected: boolean
}

export default function PayoutsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showMinimumBalanceModal, setShowMinimumBalanceModal] = useState(false)
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestAmount, setRequestAmount] = useState('')
  const [payoutInProcess, setPayoutInProcess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      try {
        const { user } = await getUserWithProxy()
        if (!user) {
          router.push('/auth')
          return
        }
        setUser(user)
        await fetchPayoutSummary(user.id)
      } catch (error) {
        console.error('Authentication failed:', error)
        router.push('/auth')
      }
    }
    getUser()
  }, [])

  const fetchPayoutSummary = async (userId: string) => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/payouts/proxy-summary', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`API Error (${response.status}): ${errorData.error || 'Failed to fetch payout summary'}`)
      }

      const data = await response.json()

      if (data.success && data.payoutSummary) {
        setPayoutSummary(data.payoutSummary)
      } else {
        throw new Error('Invalid response from payout summary API')
      }

    } catch (error: any) {
      console.error('Error fetching payout summary:', error)
      setError(`Error Loading Payouts: ${error?.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestPayoutClick = () => {
    if (!payoutSummary) return

    // If balance is less than 50 AED, show minimum balance modal
    if (payoutSummary.availableBalance < 50) {
      setShowMinimumBalanceModal(true)
      return
    }

    // If balance is sufficient, show request modal
    setShowRequestModal(true)
  }

  const handleRequestPayout = async () => {
    if (!user || !payoutSummary) return

    const amount = parseFloat(requestAmount) || payoutSummary.availableBalance

    // Validate minimum amount
    if (amount < 50) {
      alert('Minimum payout amount is AED 50')
      return
    }

    // Validate maximum amount
    if (amount > payoutSummary.availableBalance) {
      alert('Amount cannot exceed available balance')
      return
    }

    setRequestLoading(true)
    try {
      const response = await fetch('/api/payouts/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          amount: amount
        })
      })

      if (response.ok) {
        setShowRequestModal(false)
        setRequestAmount('')
        setPayoutInProcess(true)
        setSuccessMessage('Payout request submitted successfully!')
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          setSuccessMessage('')
        }, 5000)
        
        // Refresh data
        await fetchPayoutSummary(user.id)
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error || 'Failed to request payout'}`)
      }
    } catch (error) {
      console.error('Error requesting payout:', error)
      alert('Failed to request payout. Please try again.')
    } finally {
      setRequestLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'AED'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Always render something, even while loading
  if (loading && !user && !error) {
    return (
      <div className="cosmic-bg min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="cosmic-card">
            <div className="animate-pulse">
              <div className="h-8 w-32 bg-gray-700 rounded mb-4" />
              <div className="space-y-3">
                <div className="h-4 w-48 bg-gray-700 rounded" />
                <div className="h-4 w-64 bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="cosmic-bg min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="cosmic-card text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="cosmic-heading text-white mb-2">Error Loading Payouts</h2>
            <p className="cosmic-body text-white/70 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="cosmic-button-primary"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg min-h-screen">
      <div className="min-h-screen px-4 py-8">
        {/* Back to Dashboard Button */}
        <div className="flex justify-center mb-8">
          <div style={{width: '70vw'}}>
            <Link 
              href="/dashboard" 
              className="inline-flex items-center text-gray-300 hover:text-white transition-colors payment-back-button"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-center mb-6">
          <div style={{width: '70vw'}}>
            <div className="cosmic-card">
              <div>
                <h1 className="cosmic-heading mb-2">Payouts</h1>
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
                  <svg className="w-5 h-5 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-green-100 font-medium">{successMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex justify-center">
          <div style={{width: '70vw'}} className="space-y-6">
            
            {/* Payout Summary Cards */}
            {loading ? (
              <div className="flex flex-col md:flex-row gap-4">
                {[1, 2].map(i => (
                  <div key={i} className="flex-1 cosmic-card">
                    <div className="animate-pulse">
                      <div className="h-4 w-32 bg-gray-700 rounded mb-4" />
                      <div className="h-8 w-24 bg-gray-700 rounded mb-2" />
                      <div className="h-4 w-40 bg-gray-700 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-4">
                {/* My Next Payout Card */}
                <div className="flex-1 cosmic-card">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white">My Next Payout</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-gray-400 text-sm">Available Balance</p>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(payoutSummary?.availableBalance || 0)}
                      </p>
                    </div>
                    
                    {payoutInProcess && (
                      <div className="w-full text-center py-3 px-4 bg-blue-600/20 border border-blue-500/30 rounded-lg">
                        <p className="text-blue-100 font-medium">Payout in process</p>
                      </div>
                    )}
                    {!payoutSummary?.bankConnected && (
                      <div className="w-full text-center py-3 px-4 bg-yellow-600/20 border border-yellow-500/30 rounded-lg">
                        <p className="text-yellow-400 font-medium">
                          Connect your bank account using the payment methods section
                        </p>
                      </div>
                    )}
                    
                    {!payoutInProcess && payoutSummary?.bankConnected && (
                      <div className="pt-2">
                        <button 
                          onClick={handleRequestPayoutClick}
                          className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                        >
                          Request Payout
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* My Total Payouts Card */}
                <div className="flex-1 cosmic-card">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white">My Total Payouts</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400 text-sm">Paid Amount</p>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(payoutSummary?.totalEarnings || 0)}
                      </p>
                    </div>
                    
                    {payoutSummary?.lastPayoutDate && (
                      <div>
                        <p className="text-gray-400 text-sm">Last Payout</p>
                        <p className="text-white">
                          {formatCurrency(payoutSummary.lastPayoutAmount)} on {formatDate(payoutSummary.lastPayoutDate)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* My Payout Methods Card */}
                {user && <PayoutMethodsCard userId={user.id} />}
              </div>
            )}

            {/* Payout History */}
            {user && <PayoutHistory userId={user.id} />}
          </div>
        </div>

        {/* Payout Request Modal */}
        {showRequestModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">Request Payout</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Available Balance
                  </label>
                  <p className="text-xl font-bold text-white">
                    {formatCurrency(payoutSummary?.availableBalance || 0)}
                  </p>
                </div>
                
                <div>
                  <label htmlFor="amount" className="block text-sm text-gray-400 mb-2">
                    Request Amount (leave blank for full amount)
                  </label>
                  <input
                    id="amount"
                    type="number"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    placeholder={`${payoutSummary?.availableBalance || 0}`}
                    min="50"
                    max={payoutSummary?.availableBalance || 0}
                    className="cosmic-input w-full"
                  />
                </div>
                
                <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-yellow-100 text-sm font-medium">
                    ⚠️ Minimum payout amount: AED 50
                  </p>
                  <p className="text-yellow-100 text-xs mt-1">
                    Below AED 50 payouts are not possible.
                  </p>
                </div>
                
                <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-100 text-sm">
                    Payouts are typically processed within 1-2 business days to your connected bank account.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 cosmic-button-secondary"
                  disabled={requestLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestPayout}
                  disabled={requestLoading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {requestLoading ? 'Processing...' : 'Request Payout'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Minimum Balance Modal */}
        {showMinimumBalanceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-md">
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-4">Minimum Payout Required</h3>
                <p className="text-gray-300 mb-2">
                  Minimum payout shall be AED 50.
                </p>
                <p className="text-gray-300 mb-6">
                  Below AED 50 is not possible.
                </p>
                <div className="mb-6">
                  <p className="text-sm text-gray-400">Current Balance:</p>
                  <p className="text-xl font-bold text-white">
                    {formatCurrency(payoutSummary?.availableBalance || 0)}
                  </p>
                </div>
                <button
                  onClick={() => setShowMinimumBalanceModal(false)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}