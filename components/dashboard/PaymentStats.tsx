'use client'

import { useState, useEffect, useCallback } from 'react'

interface PaymentTransaction {
  id: string
  amount_aed: number
  status: string
  created_at: string
  payment_link: {
    title: string
    amount_aed: number
    client_name: string | null
  }
}

interface PaymentStatsProps {
  transactions: PaymentTransaction[]
  paymentLinks: Array<{
    id: string
    amount_aed: number
    created_at: string
    transaction_count: number
    total_revenue: number
  }>
  user: {
    id: string
    email?: string
    user_metadata?: {
      full_name?: string
    }
  } | null
}

interface DateRangeStats {
  revenue: number
  transactions: number
  averagePayment: number
  successRate: number
}

interface PopularAmount {
  amount: number
  count: number
  percentage: number
}

export default function PaymentStats({ transactions, paymentLinks, user }: PaymentStatsProps) {
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('today')
  const [statsData, setStatsData] = useState<{
    current: DateRangeStats
    previous: DateRangeStats
    popularAmounts: PopularAmount[]
    revenueByDay: Array<{ date: string; revenue: number; transactions: number }>
  } | null>(null)

  const calculateStats = useCallback(() => {
    const now = new Date()
    let currentPeriodStart: Date
    let previousPeriodStart: Date
    let previousPeriodEnd: Date

    switch (dateRange) {
      case 'today':
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        previousPeriodEnd = currentPeriodStart
        break
      case '7d':
        currentPeriodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        previousPeriodStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        previousPeriodEnd = currentPeriodStart
        break
      case '30d':
        currentPeriodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        previousPeriodStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        previousPeriodEnd = currentPeriodStart
        break
      case '90d':
        currentPeriodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        previousPeriodStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        previousPeriodEnd = currentPeriodStart
        break
      default:
        currentPeriodStart = new Date(0)
        previousPeriodStart = new Date(0)
        previousPeriodEnd = new Date(0)
    }

    // Filter transactions for current and previous periods
    const currentTransactions = transactions.filter(t => 
      new Date(t.created_at) >= currentPeriodStart
    )
    
    const previousTransactions = dateRange !== 'all' ? transactions.filter(t => {
      const date = new Date(t.created_at)
      return date >= previousPeriodStart && date < previousPeriodEnd
    }) : []

    // Calculate current period stats
    const currentRevenue = currentTransactions.reduce((sum, t) => sum + t.amount_aed, 0)
    const currentCount = currentTransactions.length
    const currentAverage = currentCount > 0 ? currentRevenue / currentCount : 0
    const currentSuccessRate = 100 // Assuming all shown transactions are successful

    // Calculate previous period stats
    const previousRevenue = previousTransactions.reduce((sum, t) => sum + t.amount_aed, 0)
    const previousCount = previousTransactions.length
    const previousAverage = previousCount > 0 ? previousRevenue / previousCount : 0
    const previousSuccessRate = 100

    // Calculate popular payment amounts
    const amountCounts = new Map<number, number>()
    paymentLinks.forEach(link => {
      const count = amountCounts.get(link.amount_aed) || 0
      amountCounts.set(link.amount_aed, count + link.transaction_count)
    })

    const totalTransactions = Array.from(amountCounts.values()).reduce((sum, count) => sum + count, 0)
    const popularAmounts: PopularAmount[] = Array.from(amountCounts.entries())
      .map(([amount, count]) => ({
        amount,
        count,
        percentage: totalTransactions > 0 ? (count / totalTransactions) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Calculate revenue by day for chart
    const revenueByDay: Array<{ date: string; revenue: number; transactions: number }> = []
    
    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
        
        const dayTransactions = transactions.filter(t => {
          const tDate = new Date(t.created_at)
          return tDate >= dayStart && tDate < dayEnd
        })
        
        revenueByDay.push({
          date: date.toISOString().split('T')[0]!,
          revenue: dayTransactions.reduce((sum, t) => sum + t.amount_aed, 0),
          transactions: dayTransactions.length
        })
      }
    }

    setStatsData({
      current: {
        revenue: currentRevenue,
        transactions: currentCount,
        averagePayment: currentAverage,
        successRate: currentSuccessRate
      },
      previous: {
        revenue: previousRevenue,
        transactions: previousCount,
        averagePayment: previousAverage,
        successRate: previousSuccessRate
      },
      popularAmounts,
      revenueByDay
    })
  }, [dateRange, transactions, paymentLinks])

  useEffect(() => {
    calculateStats()
  }, [calculateStats])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'AED'
    }).format(amount)
  }

  const formatPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+∞%' : '0%'
    const change = ((current - previous) / previous) * 100
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
  }

  const getChangeColor = (current: number, previous: number) => {
    if (current > previous) return 'text-green-400'
    if (current < previous) return 'text-red-400'
    return 'text-gray-400'
  }

  const getFilteredTransactions = () => {
    const now = new Date()
    let startDate: Date

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0) // All time
    }

    return transactions
      .filter(t => new Date(t.created_at) >= startDate)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10) // Show max 10 transactions
  }

  if (!statsData) {
    return (
      <div className="cosmic-card">
        <div className="animate-pulse">
          <div className="h-6 bg-white/20 rounded mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-white/10 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const { current, previous, popularAmounts, revenueByDay } = statsData

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="cosmic-card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="cosmic-heading text-white">Analytics</h2>
          <div className="flex space-x-2">
            {(['today', '7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                {range === 'today' ? 'Today' : range === '7d' ? 'This Week' : range === '30d' ? 'This Month' : 'Custom'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="cosmic-label text-white/70">Revenue</h3>
              {dateRange !== 'all' && (
                <span className={`text-xs font-medium ${getChangeColor(current.revenue, previous.revenue)}`}>
                  {formatPercentageChange(current.revenue, previous.revenue)}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {formatCurrency(current.revenue)}
            </p>
            {dateRange !== 'all' && (
              <p className="text-xs text-white/50">
                vs {formatCurrency(previous.revenue)} previous period
              </p>
            )}
          </div>

          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="cosmic-label text-white/70">Transactions</h3>
              {dateRange !== 'all' && (
                <span className={`text-xs font-medium ${getChangeColor(current.transactions, previous.transactions)}`}>
                  {formatPercentageChange(current.transactions, previous.transactions)}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {current.transactions}
            </p>
            {dateRange !== 'all' && (
              <p className="text-xs text-white/50">
                vs {previous.transactions} previous period
              </p>
            )}
          </div>

          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="cosmic-label text-white/70">Average Payment</h3>
              {dateRange !== 'all' && (
                <span className={`text-xs font-medium ${getChangeColor(current.averagePayment, previous.averagePayment)}`}>
                  {formatPercentageChange(current.averagePayment, previous.averagePayment)}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {formatCurrency(current.averagePayment)}
            </p>
            {dateRange !== 'all' && (
              <p className="text-xs text-white/50">
                vs {formatCurrency(previous.averagePayment)} previous period
              </p>
            )}
          </div>

          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="cosmic-label text-white/70">Anna's Commission</h3>
              {dateRange !== 'all' && (
                <span className={`text-xs font-medium ${getChangeColor(current.revenue * 0.1, previous.revenue * 0.1)}`}>
                  {formatPercentageChange(current.revenue * 0.1, previous.revenue * 0.1)}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {formatCurrency(current.revenue * 0.1)}
            </p>
            {dateRange !== 'all' && (
              <p className="text-xs text-white/50">
                vs {formatCurrency(previous.revenue * 0.1)} previous period
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      {revenueByDay.length > 0 && (
        <div className="cosmic-card">
          <h3 className="cosmic-heading text-white mb-4">Charts</h3>
          <div className="h-64 flex items-end space-x-1">
            {revenueByDay.map((day) => {
              const maxRevenue = Math.max(...revenueByDay.map(d => d.revenue), 1)
              const height = (day.revenue / maxRevenue) * 100
              
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center group">
                  <div className="relative flex-1 w-full flex items-end">
                    <div 
                      className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t-sm transition-all duration-300 group-hover:from-purple-500 group-hover:to-purple-300"
                      style={{ height: `${height}%` }}
                      title={`${day.date}: ${formatCurrency(day.revenue)} (${day.transactions} transactions)`}
                    ></div>
                  </div>
                  <span className="text-xs text-white/50 mt-2 transform rotate-45 origin-center">
                    {new Date(day.date).getDate()}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between items-center mt-4 text-xs text-white/50">
            <span>Last {dateRange === '7d' ? '7' : dateRange === '30d' ? '30' : '90'} days</span>
            <span>Peak: {formatCurrency(Math.max(...revenueByDay.map(d => d.revenue)))}</span>
          </div>
        </div>
      )}

      {/* Payments */}
      <div className="cosmic-card">
        <h3 className="cosmic-heading text-white mb-4">Payments</h3>
        <div className="space-y-3">
          {getFilteredTransactions().map((transaction, index) => (
            <div key={`${transaction.id}-${index}`} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 bg-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <span className="cosmic-body text-white font-medium">
                    {transaction.payment_link?.client_name || 'Client'} - {transaction.payment_link?.title || 'Service'}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="cosmic-body text-white font-bold">
                  {formatCurrency(transaction.amount_aed)}
                </span>
                <span className="cosmic-label text-white/50 text-sm w-20 text-right">
                  {new Date(transaction.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
          {getFilteredTransactions().length === 0 && (
            <div className="text-center py-4">
              <p className="cosmic-body text-white/50">No payments found for this period</p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}