'use client'

import React, { useState, useEffect } from 'react'
import { SplitRecipient, validateSplitRecipients, calculateSplitAmounts } from '@/lib/payment-splitting'

interface SplitRecipientsEditorProps {
  paymentAmount: number
  recipients: SplitRecipient[]
  onChange: (recipients: SplitRecipient[]) => void
  disabled?: boolean
}

export function SplitRecipientsEditor({
  paymentAmount,
  recipients,
  onChange,
  disabled = false
}: SplitRecipientsEditorProps) {
  const [validationError, setValidationError] = useState('')
  const [previewCalculations, setPreviewCalculations] = useState<{
    recipient: SplitRecipient
    amount: number
    percentage: number
  }[]>([])

  // Update preview calculations when recipients or payment amount changes
  useEffect(() => {
    try {
      if (recipients.length > 0) {
        const calculations = calculateSplitAmounts(recipients, paymentAmount)
        setPreviewCalculations(calculations)
      } else {
        setPreviewCalculations([])
      }
      setValidationError('')
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Invalid split configuration')
      setPreviewCalculations([])
    }
  }, [recipients, paymentAmount])

  const addRecipient = () => {
    const newRecipient: SplitRecipient = {
      recipientType: 'external_email',
      splitType: 'percentage',
      splitPercentage: 0,
      isPrimaryRecipient: false
    }
    
    onChange([...recipients, newRecipient])
  }

  const updateRecipient = (index: number, updates: Partial<SplitRecipient>) => {
    const newRecipients = [...recipients]
    newRecipients[index] = { ...newRecipients[index], ...updates } as SplitRecipient
    
    // If setting as primary, unset others
    if (updates.isPrimaryRecipient) {
      newRecipients.forEach((recipient, i) => {
        if (i !== index) {
          recipient.isPrimaryRecipient = false
        }
      })
    }
    
    onChange(newRecipients)
  }

  const removeRecipient = (index: number) => {
    const newRecipients = recipients.filter((_, i) => i !== index)
    onChange(newRecipients)
  }

  const getTotalPercentage = () => {
    return recipients
      .filter(r => r.splitType === 'percentage')
      .reduce((sum, r) => sum + (r.splitPercentage || 0), 0)
  }

  const getTotalFixedAmount = () => {
    return recipients
      .filter(r => r.splitType === 'fixed_amount')
      .reduce((sum, r) => sum + (r.splitAmountFixed || 0), 0)
  }

  const getRemainingAmount = () => {
    const totalFixed = getTotalFixedAmount()
    const remainingForPercentage = paymentAmount - totalFixed
    const percentageAmount = recipients
      .filter(r => r.splitType === 'percentage')
      .reduce((sum, r) => sum + (remainingForPercentage * ((r.splitPercentage || 0) / 100)), 0)
    
    return paymentAmount - totalFixed - percentageAmount
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payment Splitting</h3>
          <p className="text-sm text-gray-600">
            Configure how the ${paymentAmount.toFixed(2)} payment will be distributed
          </p>
        </div>
        <button
          type="button"
          onClick={addRecipient}
          disabled={disabled}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Recipient
        </button>
      </div>

      {/* Recipients List */}
      {recipients.length > 0 && (
        <div className="space-y-4">
          {recipients.map((recipient, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-100 text-purple-600 text-xs font-medium rounded-full">
                    {index + 1}
                  </span>
                  {recipient.isPrimaryRecipient && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                      Primary
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeRecipient(index)}
                  disabled={disabled}
                  className="text-gray-400 hover:text-red-600 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Recipient Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Type
                  </label>
                  <select
                    value={recipient.recipientType}
                    onChange={(e) => updateRecipient(index, { 
                      recipientType: e.target.value as 'platform_user' | 'external_email' | 'platform_fee',
                      // Clear fields when changing type
                      recipientUserId: undefined,
                      recipientEmail: undefined,
                      recipientName: undefined
                    })}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                  >
                    <option value="external_email">External Email</option>
                    <option value="platform_user">Platform User</option>
                    <option value="platform_fee">Platform Fee</option>
                  </select>
                </div>

                {/* Split Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Split Type
                  </label>
                  <select
                    value={recipient.splitType}
                    onChange={(e) => updateRecipient(index, { 
                      splitType: e.target.value as 'percentage' | 'fixed_amount',
                      // Clear amounts when changing type
                      splitPercentage: undefined,
                      splitAmountFixed: undefined
                    })}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed_amount">Fixed Amount</option>
                  </select>
                </div>

                {/* Recipient Contact Info */}
                {recipient.recipientType === 'external_email' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={recipient.recipientEmail || ''}
                        onChange={(e) => updateRecipient(index, { recipientEmail: e.target.value })}
                        disabled={disabled}
                        placeholder="recipient@example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={recipient.recipientName || ''}
                        onChange={(e) => updateRecipient(index, { recipientName: e.target.value })}
                        disabled={disabled}
                        placeholder="Recipient Name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                      />
                    </div>
                  </>
                )}

                {recipient.recipientType === 'platform_user' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Platform User ID
                    </label>
                    <input
                      type="text"
                      value={recipient.recipientUserId || ''}
                      onChange={(e) => updateRecipient(index, { recipientUserId: e.target.value })}
                      disabled={disabled}
                      placeholder="User ID or email lookup"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                    />
                  </div>
                )}

                {recipient.recipientType === 'platform_fee' && (
                  <div className="md:col-span-2">
                    <div className="bg-blue-50 p-3 rounded-md">
                      <p className="text-sm text-blue-800">
                        This represents the platform fee collected by DECODE. The amount will be automatically processed.
                      </p>
                    </div>
                  </div>
                )}

                {/* Split Amount */}
                {recipient.splitType === 'percentage' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Percentage (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={recipient.splitPercentage || ''}
                      onChange={(e) => updateRecipient(index, { splitPercentage: parseFloat(e.target.value) || 0 })}
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fixed Amount ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={recipient.splitAmountFixed || ''}
                      onChange={(e) => updateRecipient(index, { splitAmountFixed: parseFloat(e.target.value) || 0 })}
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                    />
                  </div>
                )}

                {/* Primary Recipient Checkbox */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`primary-${index}`}
                    checked={recipient.isPrimaryRecipient || false}
                    onChange={(e) => updateRecipient(index, { isPrimaryRecipient: e.target.checked })}
                    disabled={disabled}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded disabled:cursor-not-allowed"
                  />
                  <label htmlFor={`primary-${index}`} className="ml-2 block text-sm text-gray-700">
                    Primary recipient
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={recipient.notes || ''}
                  onChange={(e) => updateRecipient(index, { notes: e.target.value })}
                  disabled={disabled}
                  rows={2}
                  placeholder="Additional notes about this split..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100"
                />
              </div>

              {/* Preview for this recipient */}
              {previewCalculations.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm font-medium text-gray-700">Preview:</p>
                  {previewCalculations
                    .filter(calc => calc.recipient === recipient)
                    .map((calc, calcIndex) => (
                      <p key={calcIndex} className="text-sm text-gray-600">
                        Will receive: <span className="font-semibold">${calc.amount.toFixed(2)}</span> 
                        ({calc.percentage.toFixed(1)}% of total payment)
                      </p>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {recipients.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Split Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Total Percentage</p>
              <p className={`font-semibold ${getTotalPercentage() > 100 ? 'text-red-600' : 'text-gray-900'}`}>
                {getTotalPercentage().toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-gray-600">Fixed Amounts</p>
              <p className="font-semibold text-gray-900">${getTotalFixedAmount().toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">Remaining</p>
              <p className={`font-semibold ${getRemainingAmount() < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                ${getRemainingAmount().toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Recipients</p>
              <p className="font-semibold text-gray-900">{recipients.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Error */}
      {validationError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Invalid Split Configuration</h3>
              <p className="mt-1 text-sm text-red-700">{validationError}</p>
            </div>
          </div>
        </div>
      )}

      {/* No Recipients State */}
      {recipients.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Split Recipients</h3>
          <p className="text-gray-600 mb-4">
            The full payment amount will go to the payment link creator.
            Add recipients to split the payment.
          </p>
          <button
            type="button"
            onClick={addRecipient}
            disabled={disabled}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Add First Recipient
          </button>
        </div>
      )}
    </div>
  )
}

export default SplitRecipientsEditor