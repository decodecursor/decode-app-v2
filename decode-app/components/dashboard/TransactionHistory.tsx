'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface Transaction {
  id: string
  type: string
  status: string
  amount: {
    usdc: number
    aed: number
    display: string
  }
  description: string
  paymentLink: {
    id: string
    title: string
    clientName: string
    originalAmount: number
    totalAmount: number
  } | null
  crossmintTransactionId: string
  createdAt: string
  completedAt: string | null
}

interface TransactionSummary {
  totalTransactions: number
  totalReceived: {
    usdc: number
    display: string
  }
  totalTransferred: {
    usdc: number
    display: string
  }
  totalFees: {
    usdc: number
    display: string
  }
  lastTransactionAt: string | null
}

interface TransactionHistoryProps {
  user: User
  className?: string
}

export function TransactionHistory({ user, className = '' }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<TransactionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'payment_received' | 'transfer_out' | 'fee_collected'>('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const limit = 10

  useEffect(() => {
    fetchTransactions()
  }, [user.id, filter])

  const fetchTransactions = async (pageOffset = 0, append = false) => {
    try {
      if (!append) {
        setLoading(true)
      }
      setError('')
      
      const params = new URLSearchParams({
        userId: user.id,
        limit: limit.toString(),
        offset: (pageOffset * limit).toString()
      })
      
      if (filter !== 'all') {
        params.append('type', filter)
      }
      
      const response = await fetch(`/api/wallet/transactions?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions')
      }

      if (data.success) {
        const newTransactions = data.data.transactions
        
        if (append) {
          setTransactions(prev => [...prev, ...newTransactions])
        } else {
          setTransactions(newTransactions)
          setSummary(data.data.summary)
        }
        
        setHasMore(data.data.pagination.hasMore)
        setPage(pageOffset)
      } else {
        throw new Error(data.error || 'Failed to load transactions')
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
      setError(error instanceof Error ? error.message : 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchTransactions(page + 1, true)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
        </div>
      )
    } else if (type === 'transfer_out') {
      const iconColor = status === 'completed' ? 'blue' : status === 'pending' ? 'yellow' : 'red'
      return (
        <div className={`w-10 h-10 bg-${iconColor}-500/20 rounded-full flex items-center justify-center`}>
          <svg className={`w-5 h-5 text-${iconColor}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
          </svg>
        </div>
      )
    } else if (type === 'fee_collected') {
      return (
        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01" />
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed' },
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
      failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.completed
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  if (error) {
    return (
      <div className={`cosmic-card p-6 ${className}`}>
        <div className="text-center">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Transaction Error</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => fetchTransactions()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="cosmic-card p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1">Total Transactions</h3>
            <p className="text-2xl font-bold text-white">{summary.totalTransactions}</p>
          </div>
          <div className="cosmic-card p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1">Total Received</h3>
            <p className="text-2xl font-bold text-green-400">{summary.totalReceived.display}</p>
          </div>
          <div className="cosmic-card p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1">Total Transferred</h3>
            <p className="text-2xl font-bold text-blue-400">{summary.totalTransferred.display}</p>
          </div>
          <div className="cosmic-card p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-1">Total Fees</h3>
            <p className="text-2xl font-bold text-purple-400">{summary.totalFees.display}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="cosmic-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Transaction History</h3>
          <div className="flex space-x-2">
            {['all', 'payment_received', 'transfer_out', 'fee_collected'].map((filterType) => {
              const labels = {
                all: 'All',
                payment_received: 'Payments',
                transfer_out: 'Transfers',
                fee_collected: 'Fees'
              }
              
              return (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType as any)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    filter === filterType
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {labels[filterType as keyof typeof labels]}
                </button>
              )
            })}
          </div>
        </div>
        
        {loading && transactions.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <span className="ml-3 text-white">Loading transactions...</span>
          </div>
        ) : transactions.length > 0 ? (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center space-x-4 p-4 bg-gray-800/50 rounded-lg">
                {getTransactionIcon(transaction.type, transaction.status)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <p className="text-sm font-medium text-white truncate">
                      {transaction.description}
                    </p>
                    {getStatusBadge(transaction.status)}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <span>{formatDate(transaction.createdAt)}</span>
                    {transaction.paymentLink && (
                      <span>Client: {transaction.paymentLink.clientName}</span>
                    )}
                    {transaction.crossmintTransactionId && (
                      <span>ID: {transaction.crossmintTransactionId.substring(0, 8)}...</span>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{transaction.amount.display}</p>
                  {transaction.paymentLink && (
                    <p className="text-xs text-gray-400">
                      Service: AED {transaction.paymentLink.originalAmount}
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            {/* Load More Button */}
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2 mx-auto"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Load More</span>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-400">No transactions found</p>
            <p className="text-sm text-gray-500 mt-1">
              {filter === 'all' 
                ? 'Your transaction history will appear here' 
                : `No ${filter.replace('_', ' ')} transactions found`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TransactionHistory