'use client'

import { useState, useEffect } from 'react'

interface Payout {
  id: string
  payout_request_id: string | null
  payout_amount_aed: number
  status: string
  paid_at: string | null
  created_at: string
  company_name?: string
  user_name?: string
  payout_method?: 'bank_account' | 'paypal' | 'stripe_connect' | null
}

interface PayoutHistoryProps {
  userId: string
  onNewPayout?: (payoutId: string) => void
  refreshTrigger?: number
}

export function PayoutHistory({ userId, onNewPayout, refreshTrigger }: PayoutHistoryProps) {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const [visibleCount, setVisibleCount] = useState(6)
  const [previousPayoutCount, setPreviousPayoutCount] = useState(0)
  const [highlightedPayoutId, setHighlightedPayoutId] = useState<string | null>(null)

  useEffect(() => {
    loadPayouts()
  }, [userId])

  // Refresh when trigger changes (new payout added)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadPayouts()
    }
  }, [refreshTrigger])

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (exportDone) {
      timer = setTimeout(() => {
        setExportDone(false)
      }, 3000)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [exportDone])

  const loadPayouts = async () => {
    try {
      const response = await fetch('/api/payouts/history', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`API Error (${response.status}): ${errorData.error || 'Failed to fetch payouts'}`)
      }

      const data = await response.json()
      if (data.success && data.payouts) {
        const newPayouts = data.payouts

        // Check if we have a new payout (more payouts than before)
        if (newPayouts.length > previousPayoutCount && previousPayoutCount > 0 && onNewPayout) {
          // Get the newest payout (first in the list)
          const newestPayout = newPayouts[0]
          const payoutElementId = `payout-${newestPayout.id}`

          // Trigger heart animation
          onNewPayout(payoutElementId)

          // Highlight the new payout with purple background fade
          setHighlightedPayoutId(newestPayout.id)

          // Clear highlight after 3 seconds
          setTimeout(() => {
            setHighlightedPayoutId(null)
          }, 3000)
        }

        setPayouts(newPayouts)
        setPreviousPayoutCount(newPayouts.length)
      } else {
        setPayouts([])
        setPreviousPayoutCount(0)
      }
    } catch (error) {
      console.error('Error loading payouts:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      paid: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Paid' },
      failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' }
    }
    return badges[status as keyof typeof badges] || null
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(/,(?=[^,]*$)/, ' -')
  }

  const formatPayoutMethod = (method: string) => {
    switch (method) {
      case 'bank_account':
        return 'Bank Account'
      case 'paypal':
        return 'PayPal'
      case 'stripe_connect':
        return 'Stripe Connect'
      default:
        return method
    }
  }

  const exportToCSV = async () => {
    setExporting(true)
    try {
      const response = await fetch('/api/payouts/history?export=true', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`API Error (${response.status}): ${errorData.error || 'Failed to fetch payouts'}`)
      }

      const result = await response.json()
      if (!result.success || !result.payouts) {
        throw new Error('Invalid response from payouts API')
      }

      const data = result.payouts

      const headers = ['Company Name', 'Creator Name', 'Payout Request Date', 'Payout Request ID', 'Payout Method', 'Payout Amount in AED']
      const rows = (data || []).map(payout => [
        payout.company_name || 'N/A',
        payout.user_name || 'N/A',
        formatDate(payout.created_at),
        payout.payout_request_id || 'N/A',
        payout.payout_method ? formatPayoutMethod(payout.payout_method) : 'N/A',
        payout.payout_amount_aed.toFixed(2)
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payouts_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      // Show "Done!" feedback for 3 seconds
      setExportDone(true)
    } catch (error) {
      console.error('Error exporting payouts:', error)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="cosmic-card">
        <h3 className="text-lg font-semibold text-white mb-6">Payout History</h3>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Payout History</h3>
        {payouts.length > 0 && (
          <button
            onClick={exportToCSV}
            disabled={exporting || exportDone}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exportDone ? 'Done!' : exporting ? 'Exporting...' : 'Export'}
          </button>
        )}
      </div>
      
      {payouts.length === 0 ? (
        <p className="text-white text-center py-8">No payouts yet. Your first payout will appear here.</p>
      ) : (
        <>
          <div className="space-y-3">
            {payouts.slice(0, visibleCount).map((payout, index) => {
              const status = getStatusBadge(payout.status)
              const isHighlighted = highlightedPayoutId === payout.id
              return (
                <div
                  key={payout.id}
                  id={`payout-${payout.id}`}
                  className={`bg-gray-800/50 rounded-lg p-3 hover:bg-gray-700/50 transition-colors ${
                    isHighlighted
                      ? 'border-2 border-purple-500/60 animate-[fadeToNormal_3s_ease-out_forwards]'
                      : 'border-2 border-transparent'
                  }`}
                  style={{
                    animationDelay: isHighlighted ? '0s' : undefined
                  }}
                >
                  {/* Mobile Layout - Hidden on desktop */}
                  <div className="md:hidden">
                    {/* Row 1: AED Amount + Request ID */}
                    <div className="flex justify-between items-end mb-1">
                      <div className="text-white text-lg font-bold">
                        AED {payout.payout_amount_aed.toFixed(2)}
                      </div>
                      <div className="text-gray-400" style={{fontSize: '11px'}}>
                        ID: {payout.payout_request_id || 'N/A'}
                      </div>
                    </div>

                    {/* Row 2: Payout Method + Date */}
                    <div className="flex justify-between items-start">
                      <span className="text-purple-400 font-medium">
                        {payout.payout_method ? formatPayoutMethod(payout.payout_method) : 'N/A'}
                      </span>
                      <div className="text-gray-400" style={{fontSize: '11px'}}>
                        {payout.paid_at ? (
                          <>Paid on {formatDate(payout.paid_at).split(' -')[0]}</>
                        ) : (
                          <>Requested on {formatDate(payout.created_at).split(' -')[0]}</>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desktop Layout - Hidden on mobile */}
                  <div className="hidden md:grid grid-cols-4 gap-x-5 items-center">
                    <div className="flex items-center space-x-3">
                      <span className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-700 text-white text-sm font-bold rounded-full flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="cosmic-body text-green-400 font-bold">
                        AED {payout.payout_amount_aed.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="cosmic-body text-white/70">
                        {payout.payout_method ? formatPayoutMethod(payout.payout_method) : 'N/A'}
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="cosmic-label text-white/60 text-sm">
                        {payout.payout_request_id || 'N/A'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="cosmic-body text-white/70">
                        {payout.paid_at ? (
                          <>Paid on {formatDate(payout.paid_at)}</>
                        ) : (
                          <>Requested on {formatDate(payout.created_at)}</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Load More Button */}
          {visibleCount < payouts.length && (
            <div className="flex justify-center pt-6">
              <button
                onClick={() => setVisibleCount(prev => prev + 6)}
                className="cosmic-button-secondary px-6 py-3 flex flex-col items-center"
                style={{ textDecoration: 'none' }}
              >
                <span className="text-lg font-bold">Load More</span>
                <span className="text-xs font-normal">{payouts.length - visibleCount} remaining</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}