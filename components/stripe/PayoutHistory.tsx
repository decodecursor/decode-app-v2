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
}

export function PayoutHistory({ userId }: PayoutHistoryProps) {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const [visibleCount, setVisibleCount] = useState(6)

  useEffect(() => {
    loadPayouts()
  }, [userId])

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
        setPayouts(data.payouts)
      } else {
        setPayouts([])
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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

      const headers = ['Company Name', 'User Name', 'Date', 'Payout Request ID', 'Payout Method', 'Payout Amount AED']
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
        <p className="text-gray-400 text-center py-8">No payouts yet. Your first payout will appear here.</p>
      ) : (
        <>
          <div className="space-y-3">
            {payouts.slice(0, visibleCount).map((payout) => {
              const status = getStatusBadge(payout.status)
              return (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/8 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-medium">
                        AED {payout.payout_amount_aed.toFixed(2)}
                      </span>
                      {status && (
                        <span className={`text-xs px-2 py-1 rounded-full ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {payout.payout_request_id && (
                        <p className="text-sm text-gray-400">
                          Payout Request ID: <span className="font-mono text-purple-400">{payout.payout_request_id}</span>
                        </p>
                      )}
                      {payout.payout_method && (
                        <p className="text-sm text-gray-400">
                          Method: <span className="text-blue-400">{formatPayoutMethod(payout.payout_method)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white">
                      {payout.paid_at ? (
                        <>Paid on {formatDate(payout.paid_at)}</>
                      ) : (
                        <>Requested on {formatDate(payout.created_at)}</>
                      )}
                    </p>
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