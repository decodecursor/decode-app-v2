'use client'

import React, { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { SplitTransaction, TransactionSplitSummary, getSplitTransactions, getTransactionSplitSummary } from '@/lib/payment-splitting'

interface SplitTransactionDisplayProps {
  transactionId: string
  showDetails?: boolean
}

export function SplitTransactionDisplay({
  transactionId,
  showDetails = true
}: SplitTransactionDisplayProps) {
  const [splitTransactions, setSplitTransactions] = useState<SplitTransaction[]>([])
  const [splitSummary, setSplitSummary] = useState<TransactionSplitSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedSplit, setExpandedSplit] = useState<string | null>(null)

  useEffect(() => {
    loadSplitData()
  }, [transactionId])

  const loadSplitData = async () => {
    try {
      setLoading(true)
      setError('')
      
      const [splits, summary] = await Promise.all([
        getSplitTransactions(transactionId),
        getTransactionSplitSummary(transactionId)
      ])
      
      setSplitTransactions(splits)
      setSplitSummary(summary)
    } catch (err) {
      console.error('Error loading split data:', err)
      setError('Failed to load split transaction data')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'pending':
        return (
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'cancelled':
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
        )
      default:
        return null
    }
  }

  const getRecipientDisplayName = (split: SplitTransaction) => {
    if (split.recipientName) {
      return split.recipientName
    }
    if (split.recipientEmail) {
      return split.recipientEmail
    }
    if (split.recipientUserId) {
      return `User ${split.recipientUserId.slice(0, 8)}...`
    }
    return 'Unknown Recipient'
  }

  // Loading state removed - show content immediately

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!splitSummary || splitTransactions.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <svg className="w-8 h-8 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
        <p className="text-gray-600">No payment splits configured for this transaction</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Split Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Split Summary</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">${splitSummary.amountPaidUsd.toFixed(2)}</p>
            <p className="text-sm text-gray-600">Total Payment</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{splitSummary.splitCount}</p>
            <p className="text-sm text-gray-600">Recipients</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{splitSummary.processedSplits}</p>
            <p className="text-sm text-gray-600">Processed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">{splitSummary.pendingSplits}</p>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Distribution Progress</span>
            <span>
              ${splitSummary.totalSplitAmount.toFixed(2)} of ${splitSummary.amountPaidUsd.toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-600 h-3 rounded-full transition-all duration-500"
              style={{
                width: `${(splitSummary.totalSplitAmount / splitSummary.amountPaidUsd) * 100}%`
              }}
            />
          </div>
        </div>

        {splitSummary.remainingAmount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">${splitSummary.remainingAmount.toFixed(2)}</span> remains undistributed.
              This may be due to rounding or incomplete split configuration.
            </p>
          </div>
        )}
      </div>

      {/* Split Transactions List */}
      {showDetails && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900">Split Transactions</h4>
          </div>
          
          <div className="divide-y divide-gray-200">
            {splitTransactions.map((split) => (
              <div key={split.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-semibold text-gray-900">
                        {getRecipientDisplayName(split)}
                      </p>
                      {split.recipientEmail && split.recipientName && (
                        <p className="text-sm text-gray-600">{split.recipientEmail}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(split.distributionStatus)}`}>
                          <span className="mr-1.5">{getStatusIcon(split.distributionStatus)}</span>
                          {split.distributionStatus.charAt(0).toUpperCase() + split.distributionStatus.slice(1)}
                        </span>
                        {split.splitPercentageApplied && (
                          <span className="text-xs text-gray-500">
                            {split.splitPercentageApplied.toFixed(1)}% of payment
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">
                      ${split.splitAmountUsd.toFixed(2)}
                    </p>
                    {split.distributionFee && split.distributionFee > 0 && (
                      <p className="text-sm text-gray-600">
                        Fee: ${split.distributionFee.toFixed(2)}
                      </p>
                    )}
                    {split.distributionDate && (
                      <p className="text-xs text-gray-500">
                        {format(parseISO(split.distributionDate), 'MMM dd, yyyy')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Expandable Details */}
                {(split.processorTransactionId || split.failureReason || split.metadata) && (
                  <div className="mt-4">
                    <button
                      onClick={() => setExpandedSplit(expandedSplit === split.id ? null : split.id)}
                      className="text-sm text-purple-600 hover:text-purple-700 flex items-center"
                    >
                      <span>
                        {expandedSplit === split.id ? 'Hide' : 'Show'} Details
                      </span>
                      <svg
                        className={`w-4 h-4 ml-1 transition-transform ${
                          expandedSplit === split.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {expandedSplit === split.id && (
                      <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                        {split.processorTransactionId && (
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-700">Processor Transaction ID:</span>
                            <span className="text-sm text-gray-900 ml-2 font-mono">
                              {split.processorTransactionId}
                            </span>
                          </div>
                        )}
                        
                        {split.failureReason && (
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-700">Failure Reason:</span>
                            <span className="text-sm text-red-600 ml-2">{split.failureReason}</span>
                          </div>
                        )}
                        
                        {split.metadata && Object.keys(split.metadata).length > 0 && (
                          <div>
                            <span className="text-sm font-medium text-gray-700">Additional Details:</span>
                            <pre className="text-xs text-gray-600 mt-1 bg-white p-2 rounded border overflow-x-auto">
                              {JSON.stringify(split.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SplitTransactionDisplay