'use client'

import { useState } from 'react'
import Link from 'next/link'
import HeartAnimation from '@/components/effects/HeartAnimation'

interface PaymentLinkCardProps {
  id: string
  title: string
  description: string | null
  amount_aed: number
  expiration_date: string
  is_active: boolean
  created_at: string
  paid_at: string | null
  updated_at: string
  transaction_count: number
  total_revenue: number
  onCopyLink?: (linkId: string) => void
  onToggleStatus?: (linkId: string, newStatus: boolean) => void
  showActions?: boolean
  showHeartAnimation?: boolean
}

export default function PaymentLinkCard({
  id,
  title,
  description,
  amount_aed,
  expiration_date,
  is_active,
  created_at,
  paid_at,
  updated_at,
  transaction_count,
  total_revenue,
  onCopyLink,
  onToggleStatus,
  showActions = true,
  showHeartAnimation = false
}: PaymentLinkCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'AED'
    }).format(amount)
  }

  const isExpired = () => {
    return new Date() > new Date(expiration_date)
  }

  const isDeactivated = () => {
    return !is_active && !isExpired()
  }

  const getStatusColor = () => {
    if (isExpired()) return 'bg-red-500/20 text-red-400 border-red-500/30'
    if (is_active) return 'bg-green-500/20 text-green-400 border-green-500/30'
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const getStatusText = () => {
    if (isExpired()) return 'Expired'
    if (is_active) return 'Active'
    return 'Inactive'
  }

  const handleCopyLink = async () => {
    if (onCopyLink) {
      onCopyLink(id)
    } else {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const link = `${baseUrl}/pay/${id}`
      
      // DEBUG: Log the URL generation details
      console.log('🔍 PaymentLinkCard URL Debug:', {
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        windowLocationOrigin: window.location.origin,
        baseUrl,
        linkId: id,
        finalLink: link
      })
      
      try {
        await navigator.clipboard.writeText(link)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } catch (error) {
        console.error('Failed to copy link:', error)
      }
    }
  }

  const handleToggleStatus = () => {
    if (onToggleStatus && !isExpired()) {
      onToggleStatus(id, !is_active)
    }
  }

  const successRate = transaction_count > 0 ? 100 : 0 // Assuming all transactions shown are successful

  return (
    <div className="cosmic-card group hover:bg-white/15 transition-all duration-200 relative">
      {/* Heart Animation Effect */}
      <HeartAnimation isActive={showHeartAnimation} />
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-3">
            <h3 className="cosmic-heading text-white text-lg">{title}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            {transaction_count > 0 && (
              <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded-full text-xs font-medium">
                {transaction_count} transaction{transaction_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Description */}
          {description && (
            <p className="cosmic-body text-white/70 mb-4 leading-relaxed">
              {description}
            </p>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white/5 rounded-lg p-3">
              <span className="cosmic-label text-white/50 block">Amount</span>
              <p className="cosmic-body text-white font-semibold text-lg">
                {formatCurrency(amount_aed)}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <span className="cosmic-label text-white/50 block">Revenue</span>
              <p className="cosmic-body text-green-400 font-semibold text-lg">
                {formatCurrency(total_revenue)}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <span className="cosmic-label text-white/50 block">Payments</span>
              <p className="cosmic-body text-purple-400 font-semibold text-lg">
                {transaction_count}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <span className="cosmic-label text-white/50 block">Success Rate</span>
              <p className="cosmic-body text-yellow-400 font-semibold text-lg">
                {successRate}%
              </p>
            </div>
          </div>

          {/* Additional Details (Expandable) */}
          <div className="border-t border-white/10 pt-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-2 cosmic-body text-white/70 hover:text-white transition-colors"
            >
              <span>Additional Details</span>
              <svg 
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="cosmic-label text-white/50">Created</span>
                    <p className="cosmic-body text-white">{formatDate(created_at)}</p>
                  </div>
                  <div>
                    {paid_at ? (
                      <>
                        <span className="cosmic-label text-white/50">Paid On</span>
                        <p className="cosmic-body text-green-400">
                          {formatDate(paid_at)}
                        </p>
                      </>
                    ) : (
                      <>
                        <span className={`cosmic-label ${(() => {
                          if (isDeactivated()) {
                            return 'text-red-400'
                          } else if (isExpired()) {
                            return 'text-red-400'
                          } else {
                            return 'text-white/50'
                          }
                        })()}`}>
                          {(() => {
                            if (isDeactivated()) {
                              return 'Deactivated'
                            } else if (isExpired()) {
                              return 'Expired'
                            } else {
                              return 'Expires'
                            }
                          })()}
                        </span>
                        <p className={`cosmic-body ${(() => {
                          if (isDeactivated()) {
                            return 'text-red-400' // Deactivated
                          } else if (isExpired()) {
                            return 'text-red-400' // Expired
                          } else {
                            const now = new Date()
                            const expirationDate = new Date(expiration_date)
                            const diffInMs = expirationDate.getTime() - now.getTime()
                            const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24))

                            if (diffInDays === 0) {
                              return 'text-yellow-400' // Expires today
                            } else {
                              return 'text-white' // Future dates
                            }
                          }
                        })()}`}>
                          {(() => {
                            if (isDeactivated()) {
                              return formatDate(updated_at)
                            } else {
                              return formatDate(expiration_date)
                            }
                          })()}
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <span className="cosmic-label text-white/50">Link ID</span>
                    <p className="cosmic-body text-white font-mono text-xs">{id}</p>
                  </div>
                  <div>
                    <span className="cosmic-label text-white/50">Average per Transaction</span>
                    <p className="cosmic-body text-white">
                      {transaction_count > 0 ? formatCurrency(total_revenue / transaction_count) : '$0.00'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex flex-col space-y-2 ml-4">
            <button
              onClick={handleCopyLink}
              className={`cosmic-button-secondary text-xs px-3 py-2 transition-all ${
                copySuccess ? 'bg-green-500/20 text-green-400' : ''
              }`}
              title="Copy payment link"
            >
              {copySuccess ? 'Copied!' : 'Copy Link'}
            </button>
            
            <Link
              href={`/pay/${id}`}
              target="_blank"
              className="cosmic-button-secondary text-xs px-3 py-2 text-center hover:bg-blue-500/20 hover:text-blue-400 transition-all"
            >
              Preview
            </Link>

            {!isExpired() && (
              <button
                onClick={handleToggleStatus}
                className={`text-xs px-3 py-2 rounded-lg font-medium transition-all ${
                  is_active 
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' 
                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                }`}
                title={is_active ? 'Deactivate link' : 'Activate link'}
              >
                {is_active ? 'Deactivate' : 'Activate'}
              </button>
            )}

            <Link
              href={`/payment/edit/${id}`}
              className="cosmic-button-secondary text-xs px-3 py-2 text-center hover:bg-purple-500/20 hover:text-purple-400 transition-all"
            >
              Edit
            </Link>
          </div>
        )}
      </div>

      {/* Progress Bar for Revenue vs Goal (Optional) */}
      {total_revenue > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex justify-between items-center mb-2">
            <span className="cosmic-label text-white/50">Revenue Progress</span>
            <span className="cosmic-body text-white text-sm">
              {formatCurrency(total_revenue)} of {formatCurrency(amount_aed * 10)} goal
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((total_revenue / (amount_aed * 10)) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  )
}