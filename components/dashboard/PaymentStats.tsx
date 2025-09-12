'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
    creator_id: string
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
    revenueByDay: Array<{ date: string; dayNumber: number; revenue: number; transactions: number }>
  }>({
    current: { revenue: 0, transactions: 0, averagePayment: 0, successRate: 0 },
    previous: { revenue: 0, transactions: 0, averagePayment: 0, successRate: 0 },
    popularAmounts: [],
    revenueByDay: []
  })

  // Tooltip hover state for revenue chart
  const [hoveredDayData, setHoveredDayData] = useState<{
    date: string
    dayNumber: number
    revenue: number
    transactions: number
  } | null>(null)

  // Use stable date reference to prevent infinite re-renders
  const now = useMemo(() => new Date(), [dateRange])

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

    // Calculate user's personal commission from their own payment links only
    const currentMyLinks = currentPeriodLinks.filter(link => link.creator_id === user?.id)
    const previousMyLinks = previousPeriodLinks.filter(link => link.creator_id === user?.id)
    
    const currentMyRevenue = currentMyLinks.reduce((sum, link) => sum + (link.service_amount_aed || link.amount_aed), 0)
    const previousMyRevenue = previousMyLinks.reduce((sum, link) => sum + (link.service_amount_aed || link.amount_aed), 0)
    
    // Commission is 1% of user's own service revenue
    const currentMyCommission = currentMyRevenue * 0.01
    const previousMyCommission = previousMyRevenue * 0.01

    console.log(`💰 Commission Debug for User ${user?.id}:`)
    console.log(`💰 Current period: ${currentMyLinks.length} my links, Revenue: ${currentMyRevenue}, Commission: ${currentMyCommission}`)
    console.log(`💰 Previous period: ${previousMyLinks.length} my links, Revenue: ${previousMyRevenue}, Commission: ${previousMyCommission}`)
    console.log(`💰 Total company revenue: ${currentRevenue} (current), ${previousRevenue} (previous)`)

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
    const revenueByDay: Array<{ date: string; dayNumber: number; revenue: number; transactions: number }> = []
    
    if (dateRange !== 'custom' || (customDateRange?.from && customDateRange?.to)) {
      let days = 7
      let chartStart = currentPeriodStart
      
      switch (dateRange) {
        case 'today':
          days = 1
          // For today view, set to today's date at midnight local time
          chartStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
          break
        case 'week':
          days = 7
          // For week view, set to Monday at midnight local time
          const dayOfWeekForChart = now.getDay()
          const daysFromMondayForChart = dayOfWeekForChart === 0 ? 6 : dayOfWeekForChart - 1
          chartStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMondayForChart, 0, 0, 0, 0)
          break
        case 'month':
          days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
          // For month view, start from 1st day of current month in local time
          chartStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
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
        
        const dayLinks = paymentLinks.filter(link => {
          if (!link.paid_at) return false
          
          // Parse paid_at date and handle timezone properly
          const paidDate = new Date(link.paid_at)
          
          // Compare just the date parts (year, month, day) ignoring time and timezone
          return paidDate.getFullYear() === date.getFullYear() &&
                 paidDate.getMonth() === date.getMonth() &&
                 paidDate.getDate() === date.getDate()
        })
        
        const revenue = dayLinks.reduce((sum, link) => sum + (link.service_amount_aed || link.amount_aed), 0)
        const transactionCount = dayLinks.reduce((sum, link) => sum + link.transaction_count, 0)
        
        // Store date as local date string, not UTC ISO string
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const localDateStr = `${year}-${month}-${day}`
        
        revenueByDay.push({
          date: localDateStr,
          dayNumber: date.getDate(),
          revenue: revenue,
          transactions: transactionCount
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
  }, [dateRange, customDateRange, transactions, paymentLinks, now])

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


  const { current, previous, popularAmounts, revenueByDay } = statsData

  return (
    <>
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
                <span className={`text-xs font-medium ${getChangeColor(currentMyCommission, previousMyCommission)}`}>
                  {formatPercentageChange(currentMyCommission, previousMyCommission)}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {formatCurrency(currentMyCommission)}
            </p>
            {dateRange !== 'custom' && (
              <p className="text-xs text-white/50">
                vs {formatCurrency(previousMyCommission)} previous period
              </p>
            )}
          </div>

          <div className="bg-white/5 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="cosmic-label text-white/70">My Next Payout</h3>
              {dateRange !== 'custom' && (
                <span className={`text-xs font-medium ${getChangeColor(currentMyCommission, previousMyCommission)}`}>
                  {formatPercentageChange(currentMyCommission, previousMyCommission)}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {formatCurrency(currentMyCommission)}
            </p>
            {dateRange !== 'custom' && (
              <p className="text-xs text-white/50">
                vs {formatCurrency(previousMyCommission)} previous period
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="cosmic-card">
        <h3 className="cosmic-heading text-white mb-4">Revenue Analytics</h3>
        {revenueByDay.length > 0 ? (
          <>
            {(() => {
              const revenues = revenueByDay.map(d => d.revenue)
              const maxRevenue = revenues.length > 0 ? Math.max(...revenues) : 0
              const maxTransactions = Math.max(...revenueByDay.map(d => d.transactions), 1)
              
              console.log('📊 Chart Data:', revenueByDay)
              console.log('📊 Max Revenue:', maxRevenue)
              
              // Smart rounding function for Y-axis values
              const smartRound = (value: number): number => {
                if (value === 0) return 0
                if (value <= 10) return Math.round(value)
                if (value <= 50) return Math.round(value / 5) * 5
                if (value <= 100) return Math.round(value / 10) * 10
                if (value <= 500) return Math.round(value / 25) * 25
                if (value <= 1000) return Math.round(value / 50) * 50
                if (value <= 5000) return Math.round(value / 100) * 100
                if (value <= 10000) return Math.round(value / 250) * 250
                return Math.round(value / 500) * 500
              }
              
              // Calculate Y-axis scale properly
              const yAxisSteps = 5
              // If no revenue, show scale up to 100. Otherwise, add 20% padding
              const yAxisMax = maxRevenue > 0 ? Math.ceil(maxRevenue * 1.2) : 100
              
              console.log('📊 Y-Axis Max:', yAxisMax)
              
              const stepValue = yAxisMax / yAxisSteps
              const yAxisValues = Array.from({length: yAxisSteps + 1}, (_, i) => {
                const rawValue = yAxisMax - (i * stepValue)
                return i === yAxisSteps ? 0 : smartRound(rawValue)
              })
              
              // Get appropriate date labels based on period
              const getDateLabel = (day: any, index: number) => {
                const date = new Date(day.date)
                const isToday = date.toDateString() === new Date().toDateString()
                
                if (dateRange === 'today') {
                  return isToday ? 'Today' : day.dayNumber.toString()
                } else if (dateRange === 'week') {
                  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  return weekdays[date.getDay()]
                } else if (dateRange === 'month') {
                  // Show every 5th day for better spacing
                  return (day.dayNumber % 5 === 1 || day.dayNumber === 1) ? day.dayNumber.toString() : ''
                } else {
                  return day.dayNumber.toString()
                }
              }
              
              return (
                <div className="relative">
                  {/* Chart Container */}
                  <div className="flex h-80">
                    {/* Y-Axis */}
                    <div className="w-16 flex flex-col justify-between py-4 pr-2">
                      {yAxisValues.map((value, index) => (
                        <div key={index} className="text-right">
                          <span className="text-xs text-white/50">
                            {value > 0 ? formatCurrency(value).replace('AED', '').trim() : '0'}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Chart Area */}
                    <div className="flex-1 relative">
                      {/* Grid Lines */}
                      <div className="absolute inset-0">
                        {yAxisValues.map((value, index) => (
                          <div 
                            key={index}
                            className="absolute w-full border-t border-white/5"
                            style={{ top: `${(index / yAxisSteps) * 100}%` }}
                          />
                        ))}
                      </div>
                      
                      {/* Bars */}
                      <div className="h-full flex items-end space-x-1 pt-4 pb-4">
                        {revenueByDay.map((day, index) => {
                          const heightPercent = day.revenue > 0 ? (day.revenue / yAxisMax) * 100 : 1
                          const opacityLevel = day.transactions > 0 ? Math.min(0.4 + (day.transactions / maxTransactions) * 0.6, 1) : 0.3
                          
                          if (day.revenue > 0) {
                            console.log(`Bar ${index} (Day ${day.dayNumber}): revenue=${day.revenue}, yAxisMax=${yAxisMax}, heightPercent=${heightPercent}%`)
                          }
                          
                          // Create proper date object - parse as UTC to avoid timezone issues
                          const dateParts = day.date.split('-').map(Number)
                          const dayDate = new Date(dateParts[0] || 2024, (dateParts[1] || 1) - 1, dateParts[2] || 1)
                          const isToday = dayDate.toDateString() === new Date().toDateString()
                          
                          return (
                            <div 
                              key={day.date} 
                              className="flex-1 h-full flex flex-col items-center group cursor-pointer"
                              onMouseEnter={() => setHoveredDayData(day)}
                              onMouseLeave={() => setHoveredDayData(null)}
                            >
                              <div className="relative flex-1 w-full h-full flex items-end">
                                <div 
                                  className={`w-full rounded-t-sm transition-all duration-300 ${
                                    day.revenue > 0 
                                      ? isToday 
                                        ? 'bg-gradient-to-t from-yellow-500 to-yellow-300 group-hover:from-yellow-400 group-hover:to-yellow-200' 
                                        : 'bg-gradient-to-t from-purple-600 to-purple-400 group-hover:from-purple-500 group-hover:to-purple-300'
                                      : 'bg-white/10'
                                  }`}
                                  style={{ 
                                    height: `${heightPercent}%`, 
                                    minHeight: '4px'
                                  }}
                                ></div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  
                  {/* X-Axis Labels */}
                  <div className="flex ml-16">
                    {revenueByDay.map((day, index) => {
                      const label = getDateLabel(day, index)
                      return (
                        <div key={day.date} className="flex-1 text-center">
                          <span className="text-xs text-white/50">
                            {label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Shared Tooltip - positioned in upper right corner */}
                  {hoveredDayData && (
                    <div className="absolute top-4 right-4 bg-black/90 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap z-30 shadow-lg">
                      <div className="font-semibold">
                        {new Date(hoveredDayData.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div>Revenue: {formatCurrency(hoveredDayData.revenue)}</div>
                      <div>Transactions: {hoveredDayData.transactions}</div>
                    </div>
                  )}
                </div>
              )
            })()}
            
            {/* Chart Summary - only show period */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
              <div className="text-xs text-white/50">
                <span>Period: {
                  dateRange === 'today' ? `Today (${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})` : 
                  dateRange === 'week' ? (() => {
                    const dayOfWeek = now.getDay()
                    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
                    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday)
                    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
                    return `This Week (${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`
                  })() : 
                  dateRange === 'month' ? `This Month (${now.toLocaleDateString('en-US', { month: 'long' })})` : 
                  dateRange === 'custom' && customDateRange?.from && customDateRange?.to ? 
                    `${customDateRange.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${customDateRange.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` :
                    'Custom Range'
                }</span>
              </div>
            </div>
          </>
        ) : (
          <div className="h-80 flex items-center justify-center">
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
        <h3 className="cosmic-heading text-white mb-4">Successful PayLinks</h3>
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

    {/* Custom Date Picker Modal - Only render when visible */}
    {showDatePicker ? (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001]">
        <div className="cosmic-card max-w-2xl mx-4" style={{ height: '480px' }}>
          <style>{`
            .date-picker-custom { height: 380px !important; overflow: hidden !important; }
            .date-picker-custom .rdp-months { display: flex !important; gap: 1rem !important; height: 100% !important; }
            .date-picker-custom .rdp-month { min-height: 360px !important; }
            
            /* Month alignment */
            .date-picker-custom .rdp-caption {
              text-align: left !important;
              margin-bottom: 1rem !important;
            }
            
            .date-picker-custom .rdp-caption_label {
              text-align: left !important;
              margin-left: 0 !important;
            }
            
            /* Navigation arrows - comprehensive targeting */
            .date-picker-custom .rdp-nav_button,
            .date-picker-custom .rdp-nav_button_previous,
            .date-picker-custom .rdp-nav_button_next,
            .date-picker-custom button[name="previous-month"],
            .date-picker-custom button[name="next-month"],
            .date-picker-custom .rdp-button,
            .date-picker-custom .rdp-nav button,
            .date-picker-custom .rdp-nav,
            .date-picker-custom nav button { 
              color: #a855f7 !important; 
              border-color: #a855f7 !important;
              fill: #a855f7 !important;
            }
            
            .date-picker-custom .rdp-nav_button svg,
            .date-picker-custom .rdp-nav_button_previous svg,
            .date-picker-custom .rdp-nav_button_next svg,
            .date-picker-custom button[name="previous-month"] svg,
            .date-picker-custom button[name="next-month"] svg,
            .date-picker-custom .rdp-nav svg,
            .date-picker-custom nav svg {
              fill: #a855f7 !important;
              color: #a855f7 !important;
            }
            
            /* Current date (today) */
            .date-picker-custom .rdp-day_today,
            .date-picker-custom [aria-current="date"],
            .date-picker-custom .rdp-day[data-today] { 
              color: #a855f7 !important; 
              font-weight: bold !important; 
              background-color: transparent !important;
            }
            
            /* Selected dates */
            .date-picker-custom .rdp-day_selected,
            .date-picker-custom .rdp-day_range_start,
            .date-picker-custom .rdp-day_range_end,
            .date-picker-custom [aria-selected="true"],
            .date-picker-custom .rdp-day[data-selected] { 
              background-color: #a855f7 !important; 
              color: white !important; 
              border-radius: 50% !important; 
              border: none !important;
            }
            
            .date-picker-custom .rdp-day_range_middle { 
              background-color: #a855f7 !important; 
              opacity: 0.3 !important; 
              color: white !important;
            }
          `}</style>
          <div className="relative mb-4">
            <h3 className="text-lg font-semibold text-white">Select Date Range</h3>
            <button
              onClick={() => setCustomDateRange(undefined)}
              className="absolute top-0 right-0 bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded transition-colors"
            >
              Clear
            </button>
          </div>
          <DayPicker
            mode="range"
            numberOfMonths={2}
            pagedNavigation={false}
            showOutsideDays={false}
            selected={customDateRange}
            onSelect={setCustomDateRange}
            className="mb-4 date-picker-custom"
            defaultMonth={new Date(new Date().getFullYear(), new Date().getMonth() - 1)}
          />
          <div className="flex space-x-3" style={{ marginTop: '-40px', paddingTop: '10px' }}>
            <button
              onClick={() => {
                if (customDateRange?.from) {
                  setDateRange('custom')
                  setShowDatePicker(false)
                }
              }}
              disabled={!customDateRange?.from}
              className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-purple-600/20 disabled:cursor-not-allowed"
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
    ) : null}
    </>
  )
}