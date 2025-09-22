'use client'

import { useState, useEffect } from 'react'

interface Payout {
  id: string
  payout_request_id: string | null
  payout_amount_aed: number
  status: string
  period_start: string | null
  period_end: string | null
  scheduled_for: string | null
  paid_at: string | null
  created_at: string
}

interface PayoutHistoryProps {
  userId: string
}

export function PayoutHistory({ userId }: PayoutHistoryProps) {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadPayouts()
  }, [userId])

  const loadPayouts = async () => {
    try {
      const response = await fetch('/api/payouts/history?limit=10', {
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
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' },
      paid: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Paid' },
      failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' }
    }
    return badges[status as keyof typeof badges] || badges.pending
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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

      const headers = ['Request ID', 'Date', 'Amount (AED)', 'Status', 'Period Start', 'Period End', 'Paid Date']
      const rows = (data || []).map(payout => [
        payout.payout_request_id || 'N/A',
        formatDate(payout.created_at),
        payout.payout_amount_aed.toFixed(2),
        payout.status,
        payout.period_start ? formatDate(payout.period_start) : 'N/A',
        payout.period_end ? formatDate(payout.period_end) : 'N/A',
        payout.paid_at ? formatDate(payout.paid_at) : 'Pending'
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
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        )}
      </div>
      
      {payouts.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No payouts yet. Your first payout will appear here.</p>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => {
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
                    <span className={`text-xs px-2 py-1 rounded-full ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {payout.payout_request_id && (
                      <p className="text-sm text-gray-400">
                        Request ID: <span className="font-mono text-purple-400">{payout.payout_request_id}</span>
                      </p>
                    )}
                    <p className="text-sm text-gray-400">
                      Period: {payout.period_start ? formatDate(payout.period_start) : 'N/A'} - {payout.period_end ? formatDate(payout.period_end) : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">
                    {payout.paid_at ? (
                      <>Paid on {formatDate(payout.paid_at)}</>
                    ) : (
                      <>Scheduled for {payout.scheduled_for ? formatDate(payout.scheduled_for) : 'N/A'}</>
                    )}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {payouts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 text-center">
            Showing last 10 payouts. Payouts are processed every Monday.
          </p>
        </div>
      )}
    </div>
  )
}