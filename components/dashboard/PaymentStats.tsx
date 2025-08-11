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
    title: string
    amount_aed: number
    service_amount_aed: number | null
    client_name: string | null
    created_at: string
    paid_at: string | null
    transaction_count: number
    total_revenue: number
  }>
  user: {
    id: string
    email?: string
    user_metadata?: {
      user_name?: string
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

  // UAE timezone offset is +4 hours (UTC+4)
  const getUAEDate = (date: Date) => {
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000)
    return new Date(utc + (4 * 3600000))
  }

  const now = getUAEDate(new Date())

  const calculateStats = useCallback(() => {
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

    // Filter payment links by their paid_at dates
    console.log(`📊 Analytics Debug - Date Range: ${dateRange}`)
    console.log(`📊 Current Period Start: ${currentPeriodStart.toISOString()}`)
    console.log(`📊 Available Payment Links: ${paymentLinks.length}`)
    
    const currentPeriodLinks = paymentLinks.filter(link => {
      if (!link.paid_at) return false
      const paidDate = new Date(link.paid_at)
      const isIncluded = paidDate >= currentPeriodStart
      
      console.log(`📊 Payment Link ${link.id}: paid_at=${link.paid_at}, included_in_current=${isIncluded}`)
      
      return isIncluded
    })
    
    const previousPeriodLinks = dateRange !== 'custom' ? paymentLinks.filter(link => {
      if (!link.paid_at) return false
      const paidDate = new Date(link.paid_at)
      const isIncluded = paidDate >= previousPeriodStart && paidDate < previousPeriodEnd
      
      console.log(`📊 Payment Link ${link.id}: included_in_previous=${isIncluded}`)
      
      return isIncluded
    }) : []
    
    console.log(`📊 Current Period Links: ${currentPeriodLinks.length}`)
    console.log(`📊 Previous Period Links: ${previousPeriodLinks.length}`)

    // Calculate current period stats from payment links (using service_amount_aed)
    const currentRevenue = currentPeriodLinks.reduce((sum, link) => sum + (link.service_amount_aed || link.amount_aed), 0)
    const currentCount = currentPeriodLinks.reduce((sum, link) => sum + link.transaction_count, 0)
    const currentAverage = currentCount > 0 ? currentRevenue / currentCount : 0
    const currentSuccessRate = 100 // All paid links are successful

    // Calculate previous period stats from payment links (using service_amount_aed)
    const previousRevenue = previousPeriodLinks.reduce((sum, link) => sum + (link.service_amount_aed || link.amount_aed), 0)
    const previousCount = previousPeriodLinks.reduce((sum, link) => sum + link.transaction_count, 0)
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
          // For today view, ensure chartStart is set to today's date in UAE timezone
          chartStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          chartStart.setHours(0, 0, 0, 0)
          break
        case 'week':
          days = 7
          // For week view, ensure chartStart is set to Monday in UAE timezone
          const dayOfWeekForChart = now.getDay()
          const daysFromMondayForChart = dayOfWeekForChart === 0 ? 6 : dayOfWeekForChart - 1
          chartStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMondayForChart)
          chartStart.setHours(0, 0, 0, 0)
          break
        case 'month':
          days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
          // For month view, ensure chartStart is properly set to 1st day in UAE timezone
          chartStart = new Date(now.getFullYear(), now.getMonth(), 1)
          chartStart.setHours(0, 0, 0, 0)
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
        // chartStart is already in UAE timezone, no need for double conversion
        const date = new Date(chartStart.getTime() + i * 24 * 60 * 60 * 1000)
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
        
        const dayLinks = paymentLinks.filter(link => {
          if (!link.paid_at) return false
          const paidDate = new Date(link.paid_at)
          return paidDate >= dayStart && paidDate < dayEnd
        })
        
        revenueByDay.push({
          date: date.toISOString().split('T')[0]!,
          revenue: dayLinks.reduce((sum, link) => sum + (link.service_amount_aed || link.amount_aed), 0),
          transactions: dayLinks.reduce((sum, link) => sum + link.transaction_count, 0)
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
  }, [dateRange, customDateRange, transactions, paymentLinks, now, getUAEDate])

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

  const getFilteredPayments = () => {
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

    // Get payment links that were paid in the selected period
    const filteredLinks = paymentLinks.filter(link => {
      if (!link.paid_at) return false
      const paidDate = new Date(link.paid_at)
      return paidDate >= startDate && paidDate <= endDate
    })

    // Return payment links sorted by paid_at date
    return filteredLinks
      .sort((a, b) => {
        const aDate = new Date(b.paid_at!)
        const bDate = new Date(a.paid_at!)
        return aDate.getTime() - bDate.getTime()
      })
      .slice(0, 10)
  }

  const formatPaymentDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
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
              <h3 className="cosmic-label text-white/70">Company Revenue</h3>
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
              <h3 className="cosmic-label text-white/70">Company Transactions</h3>
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
              <h3 className="cosmic-label text-white/70">My Commission</h3>
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
              <h3 className="cosmic-label text-white/70">My Next Payout</h3>
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
      </div>

      {/* Revenue Chart */}
      <div className="cosmic-card">
        <h3 className="cosmic-heading text-white mb-4">Charts</h3>
        {revenueByDay.length > 0 ? (
          <>
            <div className="h-64 flex items-end space-x-1">
              {revenueByDay.map((day) => {
                const maxRevenue = Math.max(...revenueByDay.map(d => d.revenue), 1)
                const height = day.revenue > 0 ? (day.revenue / maxRevenue) * 100 : 2
                
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center group">
                    <div className="relative flex-1 w-full flex items-end">
                      <div 
                        className={`w-full rounded-t-sm transition-all duration-300 ${
                          day.revenue > 0 
                            ? 'bg-gradient-to-t from-purple-600 to-purple-400 group-hover:from-purple-500 group-hover:to-purple-300' 
                            : 'bg-white/10'
                        }`}
                        style={{ height: `${height}%`, minHeight: '2px' }}
                        title={`${day.date}: ${formatCurrency(day.revenue)} (${day.transactions} transactions)`}
                      ></div>
                    </div>
                    <span className="text-xs text-white/50 mt-2 transform rotate-45 origin-center">
                      {parseInt(day.date.split('-')[2])}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between items-center mt-4 text-xs text-white/50">
              <span>Period: {
                dateRange === 'today' ? `Today (${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})` : 
                dateRange === 'week' ? 'This Week' : 
                dateRange === 'month' ? `This Month (${now.toLocaleDateString('en-US', { month: 'long' })})` : 
                'Custom Range'
              }</span>
              <span>Total: {formatCurrency(revenueByDay.reduce((sum, d) => sum + d.revenue, 0))}</span>
            </div>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="cosmic-body text-white/50">No data available for the selected period</p>
              <p className="cosmic-label text-white/30 mt-1">Try selecting a different date range</p>
            </div>
          </div>
        )}
      </div>

      {/* PayLinks */}
      <div className="cosmic-card">
        <h3 className="cosmic-heading text-white mb-4">PayLinks</h3>
        <div className="space-y-3">
          {getFilteredPayments().map((payment, index) => (
            <div key={`${payment.id}-${index}`} className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <span className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-700 text-white text-sm font-bold rounded-full flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="cosmic-body text-white font-semibold">
                    {payment.client_name || 'Client'}
                  </span>
                  <span className="cosmic-body text-white/70">•</span>
                  <span className="cosmic-body text-white/90">
                    {payment.title || 'Service'}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="cosmic-body text-green-400 font-bold">
                    {formatCurrency(payment.service_amount_aed || payment.amount_aed)}
                  </span>
                  <span className="cosmic-label text-white/60 text-sm min-w-[140px] text-right">
                    {formatPaymentDate(payment.paid_at!)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {getFilteredPayments().length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="cosmic-body text-white/50">No payments found for this period</p>
            </div>
          )}
        </div>
      </div>

    </div>

    {/* Custom Date Picker Modal - Moved outside stacking context */}
    {showDatePicker && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001]">
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
  )
}