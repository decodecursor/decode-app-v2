'use client'

import { useState, useEffect, useCallback } from 'react'
import { DayPicker, DateRange } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

interface PaymentTransaction {
  id: string
  amount_aed: number
  status: string
  created_at: string
  completed_at?: string | null
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
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [statsData, setStatsData] = useState<{
    current: DateRangeStats
    previous: DateRangeStats
    popularAmounts: PopularAmount[]
    revenueByDay: Array<{ date: string; revenue: number; transactions: number }>
  } | null>(null)

  const calculateStats = useCallback(() => {
    // UAE timezone offset is +4 hours (UTC+4)
    const getUAEDate = (date: Date) => {
      const utc = date.getTime() + (date.getTimezoneOffset() * 60000)
      return new Date(utc + (4 * 3600000))
    }

    const now = getUAEDate(new Date())
    let currentPeriodStart: Date
    let previousPeriodStart: Date
    let previousPeriodEnd: Date

    switch (dateRange) {
      case 'today':
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        previousPeriodEnd = currentPeriodStart
        break
      case 'week':
        // Start from Monday 12 midnight
        const dayOfWeek = now.getDay()
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday)
        currentPeriodStart.setHours(0, 0, 0, 0)
        previousPeriodStart = new Date(currentPeriodStart.getTime() - 7 * 24 * 60 * 60 * 1000)
        previousPeriodEnd = currentPeriodStart
        break
      case 'month':
        // Start from 1st day of month at 12 midnight
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        currentPeriodStart.setHours(0, 0, 0, 0)
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        previousPeriodStart = prevMonth
        previousPeriodEnd = currentPeriodStart
        break
      case 'custom':
        if (customDateRange?.from && customDateRange?.to) {
          currentPeriodStart = new Date(customDateRange.from)
          currentPeriodStart.setHours(0, 0, 0, 0)
          // For custom range, no previous period comparison
          previousPeriodStart = new Date(0)
          previousPeriodEnd = new Date(0)
        } else {
          // Fallback to today if custom range not set
          currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          previousPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
          previousPeriodEnd = currentPeriodStart
        }
        break
      default:
        currentPeriodStart = new Date(0)
        previousPeriodStart = new Date(0)
        previousPeriodEnd = new Date(0)
    }

    // Filter transactions for current and previous periods (using when payment was completed)
    console.log(`📊 Analytics Debug - Date Range: ${dateRange}`)
    console.log(`📊 Current Period Start: ${currentPeriodStart.toISOString()}`)
    console.log(`📊 Previous Period Start: ${previousPeriodStart.toISOString()}`)
    console.log(`📊 Previous Period End: ${previousPeriodEnd.toISOString()}`)
    console.log(`📊 Total Transactions Available: ${transactions.length}`)
    
    const currentTransactions = transactions.filter(t => {
      // Use completed_at if available, fallback to created_at
      const transactionDate = new Date(t.completed_at || t.created_at)
      const isIncluded = transactionDate >= currentPeriodStart
      
      console.log(`📊 Transaction ${t.id}: completed_at=${t.completed_at}, created_at=${t.created_at}, using_date=${transactionDate.toISOString()}, included_in_current=${isIncluded}`)
      
      return isIncluded
    })
    
    const previousTransactions = dateRange !== 'custom' ? transactions.filter(t => {
      // Use completed_at if available, fallback to created_at
      const transactionDate = new Date(t.completed_at || t.created_at)
      const isIncluded = transactionDate >= previousPeriodStart && transactionDate < previousPeriodEnd
      
      console.log(`📊 Transaction ${t.id}: included_in_previous=${isIncluded}`)
      
      return isIncluded
    }) : []
    
    console.log(`📊 Current Period Transactions: ${currentTransactions.length}`)
    console.log(`📊 Previous Period Transactions: ${previousTransactions.length}`)

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
    
    if (dateRange !== 'custom' || (customDateRange?.from && customDateRange?.to)) {
      let days = 7
      let chartStart = currentPeriodStart
      
      switch (dateRange) {
        case 'today':
          days = 1
          break
        case 'week':
          days = 7
          break
        case 'month':
          days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
          break
        case 'custom':
          if (customDateRange?.from && customDateRange?.to) {
            const diffTime = Math.abs(customDateRange.to.getTime() - customDateRange.from.getTime())
            days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
            chartStart = customDateRange.from
          }
          break
      }
      
      for (let i = 0; i < days; i++) {
        const date = new Date(chartStart.getTime() + i * 24 * 60 * 60 * 1000)
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
        
        const dayTransactions = transactions.filter(t => {
          // Use completed_at if available, fallback to created_at
          const tDate = new Date(t.completed_at || t.created_at)
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
  }, [dateRange, customDateRange, transactions, paymentLinks])

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
    const getUAEDate = (date: Date) => {
      const utc = date.getTime() + (date.getTimezoneOffset() * 60000)
      return new Date(utc + (4 * 3600000))
    }

    const now = getUAEDate(new Date())
    let startDate: Date
    let endDate: Date = now

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        const dayOfWeek = now.getDay()
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'custom':
        if (customDateRange?.from) {
          startDate = new Date(customDateRange.from)
          startDate.setHours(0, 0, 0, 0)
          if (customDateRange.to) {
            endDate = new Date(customDateRange.to)
            endDate.setHours(23, 59, 59, 999)
          }
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        }
        break
      default:
        startDate = new Date(0)
    }

    return transactions
      .filter(t => {
        // Use completed_at if available, fallback to created_at
        const tDate = new Date(t.completed_at || t.created_at)
        return tDate >= startDate && tDate <= endDate
      })
      .sort((a, b) => {
        const aDate = new Date(b.completed_at || b.created_at)
        const bDate = new Date(a.completed_at || a.created_at)
        return aDate.getTime() - bDate.getTime()
      })
      .slice(0, 10)
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
            {(['today', 'week', 'month', 'custom'] as const).map((range) => (
              <button
                key={range}
                onClick={() => {
                  if (range === 'custom') {
                    setShowDatePicker(true)
                  } else {
                    setDateRange(range)
                    setShowDatePicker(false)
                  }
                }}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'Custom'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="cosmic-label text-white/70">Revenue</h3>
              {dateRange !== 'custom' && (
                <span className={`text-xs font-medium ${getChangeColor(current.revenue, previous.revenue)}`}>
                  {formatPercentageChange(current.revenue, previous.revenue)}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {formatCurrency(current.revenue)}
            </p>
            {dateRange !== 'custom' && (
              <p className="text-xs text-white/50">
                vs {formatCurrency(previous.revenue)} previous period
              </p>
            )}
          </div>

          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="cosmic-label text-white/70">Transactions</h3>
              {dateRange !== 'custom' && (
                <span className={`text-xs font-medium ${getChangeColor(current.transactions, previous.transactions)}`}>
                  {formatPercentageChange(current.transactions, previous.transactions)}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {current.transactions}
            </p>
            {dateRange !== 'custom' && (
              <p className="text-xs text-white/50">
                vs {previous.transactions} previous period
              </p>
            )}
          </div>

          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="cosmic-label text-white/70">Anna's Commission</h3>
              {dateRange !== 'custom' && (
                <span className={`text-xs font-medium ${getChangeColor(current.revenue * 0.01, previous.revenue * 0.01)}`}>
                  {formatPercentageChange(current.revenue * 0.01, previous.revenue * 0.01)}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {formatCurrency(current.revenue * 0.01)}
            </p>
            {dateRange !== 'custom' && (
              <p className="text-xs text-white/50">
                vs {formatCurrency(previous.revenue * 0.01)} previous period
              </p>
            )}
          </div>

          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="cosmic-label text-white/70">Next Payout</h3>
              {dateRange !== 'custom' && (
                <span className={`text-xs font-medium ${getChangeColor(current.revenue * 0.1, previous.revenue * 0.1)}`}>
                  {formatPercentageChange(current.revenue * 0.1, previous.revenue * 0.1)}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {formatCurrency(current.revenue * 0.1)}
            </p>
            {dateRange !== 'custom' && (
              <p className="text-xs text-white/50">
                vs {formatCurrency(previous.revenue * 0.1)} previous period
              </p>
            )}
          </div>
        </div>
        
        {/* Custom Date Picker Modal */}
        {showDatePicker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Select Date Range</h3>
              <DayPicker
                mode="range"
                selected={customDateRange}
                onSelect={setCustomDateRange}
                className="mb-4"
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    if (customDateRange?.from) {
                      setDateRange('custom')
                      setShowDatePicker(false)
                    }
                  }}
                  disabled={!customDateRange?.from}
                  className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
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
            <span>Period: {dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'This Week' : dateRange === 'month' ? 'This Month' : 'Custom Range'}</span>
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
                  {new Date(transaction.completed_at || transaction.created_at).toLocaleDateString()}
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