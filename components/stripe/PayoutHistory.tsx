'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Payout {
  id: string
  amount_aed: number
  status: string
  period_start: string
  period_end: string
  scheduled_for: string
  paid_at: string | null
  created_at: string
}

interface PayoutHistoryProps {
  userId: string
}

export function PayoutHistory({ userId }: PayoutHistoryProps) {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayouts()
  }, [userId])

  const loadPayouts = async () => {
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setPayouts(data || [])
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
      <h3 className="text-lg font-semibold text-white mb-6">Payout History</h3>
      
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
                      AED {payout.amount_aed.toFixed(2)}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    Period: {formatDate(payout.period_start)} - {formatDate(payout.period_end)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">
                    {payout.paid_at ? (
                      <>Paid on {formatDate(payout.paid_at)}</>
                    ) : (
                      <>Scheduled for {formatDate(payout.scheduled_for)}</>
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