'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'

interface WalletBalance {
  hasWallet: boolean
  walletAddress?: string
  balance: {
    calculated: {
      totalReceived: { usdc: number; display: string }
      totalTransferred: { usdc: number; display: string }
      available: { usdc: number; display: string }
    }
    pending: {
      transfersPending: { usdc: number; display: string }
    }
  }
  summary: {
    totalEarnings: { usdc: number; display: string }
    availableBalance: { usdc: number; display: string }
  }
  recentActivity: {
    last30Days: {
      earnings: { usdc: number; display: string }
      transactionCount: number
    }
    recentTransactions: Array<{
      type: string
      status: string
      amount: string
      description: string
      date: string
    }>
  }
}

interface WalletDashboardProps {
  user: User
  className?: string
}

export function WalletDashboard({ user, className = '' }: WalletDashboardProps) {
  const [walletData, setWalletData] = useState<WalletBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creatingWallet, setCreatingWallet] = useState(false)

  useEffect(() => {
    fetchWalletData()
  }, [user.id])

  const fetchWalletData = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/wallet/balance?userId=${user.id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch wallet data')
      }

      if (data.success) {
        setWalletData(data.data)
      } else {
        throw new Error(data.error || 'Failed to load wallet data')
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load wallet')
    } finally {
      setLoading(false)
    }
  }

  const createWallet = async () => {
    try {
      setCreatingWallet(true)
      setError('')
      
      const response = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create wallet')
      }

      if (data.success) {
        console.log('✅ Wallet created successfully')
        // Refresh wallet data
        await fetchWalletData()
      } else {
        throw new Error(data.error || 'Failed to create wallet')
      }
    } catch (error) {
      console.error('Error creating wallet:', error)
      setError(error instanceof Error ? error.message : 'Failed to create wallet')
    } finally {
      setCreatingWallet(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTransactionIcon = (type: string, status: string) => {
    if (type === 'payment_received') {
      return (
        <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        </div>
      )
    } else if (type === 'transfer_out') {
      const iconColor = status === 'completed' ? 'blue' : status === 'pending' ? 'yellow' : 'red'
      return (
        <div className={`w-10 h-10 bg-${iconColor}-500/20 rounded-full flex items-center justify-center`}>
          <svg className={`w-5 h-5 text-${iconColor}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
      )
    }
    
    return (
      <div className="w-10 h-10 bg-gray-500/20 rounded-full flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`cosmic-card ${className}`}>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-white">Loading wallet...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`cosmic-card ${className}`}>
        <div className="p-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Wallet Error</h3>
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={fetchWalletData}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!walletData?.hasWallet) {
    return (
      <div className={`cosmic-card ${className}`}>
        <div className="p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Create Your Crypto Wallet</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Set up your crypto wallet to receive payments from customers. 
              You'll be able to withdraw your earnings as USDC cryptocurrency.
            </p>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Secure custodial wallet managed by Crossmint</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Automatic payouts after each payment</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>3.2%-7% tiered marketplace fee automatically deducted</span>
              </div>
            </div>
            
            <button
              onClick={createWallet}
              disabled={creatingWallet}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center space-x-2 mx-auto"
            >
              {creatingWallet ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Creating wallet...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Create Wallet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Wallet Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Available Balance */}
        <div className="cosmic-card p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-400">Available Balance</h3>
              <p className="text-xl font-bold text-white">{walletData.balance.calculated.available.display}</p>
            </div>
          </div>
        </div>

        {/* Total Earnings */}
        <div className="cosmic-card p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-400">Total Earnings</h3>
              <p className="text-xl font-bold text-white">{walletData.balance.calculated.totalReceived.display}</p>
            </div>
          </div>
        </div>

        {/* Pending Transfers */}
        <div className="cosmic-card p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-400">Pending Transfers</h3>
              <p className="text-xl font-bold text-white">{walletData.balance.pending.transfersPending.display}</p>
            </div>
          </div>
        </div>

        {/* This Month */}
        <div className="cosmic-card p-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-400">Last 30 Days</h3>
              <p className="text-xl font-bold text-white">{walletData.recentActivity.last30Days.earnings.display}</p>
              <p className="text-xs text-gray-500">{walletData.recentActivity.last30Days.transactionCount} transactions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Info */}
      <div className="cosmic-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Wallet Information</h3>
          <div className="flex items-center space-x-2 text-sm text-green-400">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>Active</span>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-400">Wallet Address</label>
            <div className="flex items-center space-x-2 mt-1">
              <code className="text-sm text-white bg-gray-800 px-3 py-2 rounded-lg flex-1 truncate">
                {walletData.walletAddress}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(walletData.walletAddress || '')}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Copy wallet address"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="cosmic-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
          <Link href="/dashboard/wallet/transactions" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
            View All
          </Link>
        </div>
        
        {walletData.recentActivity.recentTransactions.length > 0 ? (
          <div className="space-y-4">
            {walletData.recentActivity.recentTransactions.map((transaction, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 bg-gray-800/50 rounded-lg">
                {getTransactionIcon(transaction.type, transaction.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(transaction.date)} • {transaction.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{transaction.amount}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-400">No transactions yet</p>
            <p className="text-sm text-gray-500 mt-1">Your transaction history will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default WalletDashboard