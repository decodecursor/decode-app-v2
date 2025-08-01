import { supabase } from './supabase'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, format, parseISO } from 'date-fns'

export interface AnalyticsData {
  totalRevenue: number
  totalTransactions: number
  successRate: number
  averageOrderValue: number
  revenueByDay: RevenueByDay[]
  paymentMethodBreakdown: PaymentMethodBreakdown[]
  geographicDistribution: GeographicData[]
  conversionRate: ConversionRate
  customerInsights: CustomerInsights
  splitPaymentAnalytics: SplitPaymentAnalytics
}

export interface SplitPaymentAnalytics {
  totalSplitPayments: number
  totalSplitRecipients: number
  averageRecipientsPerPayment: number
  totalDistributedAmount: number
  pendingDistributions: number
  failedDistributions: number
  topRecipients: TopSplitRecipient[]
  splitsByType: SplitTypeBreakdown[]
}

export interface TopSplitRecipient {
  recipientEmail?: string
  recipientName?: string
  recipientUserId?: string
  totalReceived: number
  transactionCount: number
  lastTransaction: string
}

export interface SplitTypeBreakdown {
  splitType: 'percentage' | 'fixed_amount'
  count: number
  totalAmount: number
  averageAmount: number
}

export interface RevenueByDay {
  date: string
  revenue: number
  transactions: number
  successRate: number
}

export interface PaymentMethodBreakdown {
  method: string
  count: number
  percentage: number
  revenue: number
}

export interface GeographicData {
  country: string
  count: number
  revenue: number
  percentage: number
}

export interface ConversionRate {
  paymentLinksCreated: number
  paymentLinksUsed: number
  totalPayments: number
  conversionRate: number
  usageRate: number
}

export interface CustomerInsights {
  totalUniqueCustomers: number
  returningCustomers: number
  averageCustomerValue: number
  topSpendingCustomers: TopCustomer[]
}

export interface TopCustomer {
  email: string
  totalSpent: number
  transactionCount: number
  lastTransaction: string
}

export interface AnalyticsFilter {
  startDate?: Date
  endDate?: Date
  creatorId?: string
  status?: 'completed' | 'failed' | 'all'
}

/**
 * Main analytics aggregation function
 */
export async function getAnalyticsData(filter: AnalyticsFilter = {}): Promise<AnalyticsData> {
  try {
    const { startDate, endDate, creatorId, status } = filter
    
    // Get base transaction data
    const transactions = await getTransactionData(filter)
    const paymentLinks = await getPaymentLinksData(filter)
    
    // Calculate core metrics (in AED - business currency)
    const totalRevenue = transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + (t.amount_aed || 0), 0)
    
    const completedTransactions = transactions.filter(t => t.status === 'completed')
    const totalTransactions = transactions.length
    const successRate = totalTransactions > 0 ? (completedTransactions.length / totalTransactions) * 100 : 0
    const averageOrderValue = completedTransactions.length > 0 ? totalRevenue / completedTransactions.length : 0
    
    // Generate analytics components
    const revenueByDay = await generateRevenueByDay(transactions, startDate, endDate)
    const paymentMethodBreakdown = generatePaymentMethodBreakdown(transactions)
    const geographicDistribution = await generateGeographicDistribution(transactions)
    const conversionRate = calculateConversionRate(paymentLinks, transactions)
    const customerInsights = generateCustomerInsights(transactions)
    const splitPaymentAnalytics = await generateSplitPaymentAnalytics(filter)
    
    return {
      totalRevenue,
      totalTransactions,
      successRate,
      averageOrderValue,
      revenueByDay,
      paymentMethodBreakdown,
      geographicDistribution,
      conversionRate,
      customerInsights,
      splitPaymentAnalytics
    }
  } catch (error) {
    console.error('Error fetching analytics data:', error)
    throw error
  }
}

/**
 * Get transaction data with filters
 */
async function getTransactionData(filter: AnalyticsFilter) {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      payment_link:payment_links!payment_link_id (
        id,
        title,
        creator_id,
        created_at
      )
    `)
  
  if (filter.startDate) {
    query = query.gte('created_at', filter.startDate.toISOString())
  }
  
  if (filter.endDate) {
    query = query.lte('created_at', filter.endDate.toISOString())
  }
  
  if (filter.status && filter.status !== 'all') {
    query = query.eq('status', filter.status)
  }
  
  if (filter.creatorId) {
    query = query.eq('payment_link.creator_id', filter.creatorId)
  }
  
  const { data, error } = await query
  
  if (error) {
    throw error
  }
  
  return data || []
}

/**
 * Get payment links data with filters
 */
async function getPaymentLinksData(filter: AnalyticsFilter) {
  let query = supabase
    .from('payment_links')
    .select('*')
  
  if (filter.startDate) {
    query = query.gte('created_at', filter.startDate.toISOString())
  }
  
  if (filter.endDate) {
    query = query.lte('created_at', filter.endDate.toISOString())
  }
  
  if (filter.creatorId) {
    query = query.eq('creator_id', filter.creatorId)
  }
  
  const { data, error } = await query
  
  if (error) {
    throw error
  }
  
  return data || []
}

/**
 * Generate revenue by day data for charts
 */
async function generateRevenueByDay(transactions: any[], startDate?: Date, endDate?: Date): Promise<RevenueByDay[]> {
  const now = new Date()
  const defaultStartDate = startDate || subDays(now, 30)
  const defaultEndDate = endDate || now
  
  const revenueMap = new Map<string, { revenue: number; transactions: number; failed: number }>()
  
  // Initialize all dates with zero values
  const currentDate = new Date(defaultStartDate)
  while (currentDate <= defaultEndDate) {
    const dateStr = format(currentDate, 'yyyy-MM-dd')
    revenueMap.set(dateStr, { revenue: 0, transactions: 0, failed: 0 })
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  // Aggregate transaction data by date
  transactions.forEach(transaction => {
    const date = format(parseISO(transaction.created_at), 'yyyy-MM-dd')
    const existing = revenueMap.get(date) || { revenue: 0, transactions: 0, failed: 0 }
    
    if (transaction.status === 'completed') {
      existing.revenue += (transaction.amount_aed || 0)
      existing.transactions += 1
    } else {
      existing.failed += 1
    }
    
    revenueMap.set(date, existing)
  })
  
  // Convert to array format for charts
  return Array.from(revenueMap.entries()).map(([date, data]) => ({
    date,
    revenue: data.revenue,
    transactions: data.transactions,
    successRate: data.transactions + data.failed > 0 
      ? (data.transactions / (data.transactions + data.failed)) * 100 
      : 0
  })).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Generate payment method breakdown
 */
function generatePaymentMethodBreakdown(transactions: any[]): PaymentMethodBreakdown[] {
  const completedTransactions = transactions.filter(t => t.status === 'completed')
  const total = completedTransactions.length
  
  if (total === 0) {
    return []
  }
  
  // For now, we'll assume all payments are through Crossmint
  // In the future, this could be expanded to support multiple payment processors
  const methodMap = new Map<string, { count: number; revenue: number }>()
  
  completedTransactions.forEach(transaction => {
    const method = transaction.payment_processor || 'Crossmint'
    const existing = methodMap.get(method) || { count: 0, revenue: 0 }
    existing.count += 1
    existing.revenue += (transaction.amount_aed || 0)
    methodMap.set(method, existing)
  })
  
  return Array.from(methodMap.entries()).map(([method, data]) => ({
    method,
    count: data.count,
    percentage: (data.count / total) * 100,
    revenue: data.revenue
  }))
}

/**
 * Generate geographic distribution (placeholder - would need IP geolocation)
 */
async function generateGeographicDistribution(transactions: any[]): Promise<GeographicData[]> {
  const completedTransactions = transactions.filter(t => t.status === 'completed')
  const total = completedTransactions.length
  
  if (total === 0) {
    return []
  }
  
  // Placeholder geographic data
  // In a real implementation, you'd use IP geolocation or billing address data
  const countries = [
    { country: 'United States', count: Math.floor(total * 0.6), revenue: 0 },
    { country: 'Canada', count: Math.floor(total * 0.2), revenue: 0 },
    { country: 'United Kingdom', count: Math.floor(total * 0.1), revenue: 0 },
    { country: 'Australia', count: Math.floor(total * 0.1), revenue: 0 },
  ]
  
  // Calculate revenue for each country
  let remainingTransactions = [...completedTransactions]
  
  return countries.map(country => {
    const countryTransactions = remainingTransactions.slice(0, country.count)
    remainingTransactions = remainingTransactions.slice(country.count)
    
    const revenue = countryTransactions.reduce((sum, t) => sum + (t.amount_aed || 0), 0)
    
    return {
      country: country.country,
      count: country.count,
      revenue,
      percentage: (country.count / total) * 100
    }
  }).filter(country => country.count > 0)
}

/**
 * Calculate conversion rates
 */
function calculateConversionRate(paymentLinks: any[], transactions: any[]): ConversionRate {
  const paymentLinksCreated = paymentLinks.length
  const usedPaymentLinks = new Set(transactions.map(t => t.payment_link_id)).size
  const totalPayments = transactions.filter(t => t.status === 'completed').length
  
  const usageRate = paymentLinksCreated > 0 ? (usedPaymentLinks / paymentLinksCreated) * 100 : 0
  const conversionRate = usedPaymentLinks > 0 ? (totalPayments / usedPaymentLinks) * 100 : 0
  
  return {
    paymentLinksCreated,
    paymentLinksUsed: usedPaymentLinks,
    totalPayments,
    conversionRate,
    usageRate
  }
}

/**
 * Generate customer insights
 */
function generateCustomerInsights(transactions: any[]): CustomerInsights {
  const completedTransactions = transactions.filter(t => t.status === 'completed')
  
  if (completedTransactions.length === 0) {
    return {
      totalUniqueCustomers: 0,
      returningCustomers: 0,
      averageCustomerValue: 0,
      topSpendingCustomers: []
    }
  }
  
  // Group transactions by customer email
  const customerMap = new Map<string, { total: number; count: number; lastTransaction: string }>()
  
  completedTransactions.forEach(transaction => {
    const email = transaction.buyer_email || 'Anonymous'
    const existing = customerMap.get(email) || { total: 0, count: 0, lastTransaction: transaction.created_at }
    existing.total += (transaction.amount_aed || 0)
    existing.count += 1
    existing.lastTransaction = transaction.created_at
    customerMap.set(email, existing)
  })
  
  const customers = Array.from(customerMap.entries())
  const totalUniqueCustomers = customers.length
  const returningCustomers = customers.filter(([_, data]) => data.count > 1).length
  const totalRevenue = completedTransactions.reduce((sum, t) => sum + (t.amount_aed || 0), 0)
  const averageCustomerValue = totalUniqueCustomers > 0 ? totalRevenue / totalUniqueCustomers : 0
  
  const topSpendingCustomers = customers
    .map(([email, data]) => ({
      email,
      totalSpent: data.total,
      transactionCount: data.count,
      lastTransaction: data.lastTransaction
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10)
  
  return {
    totalUniqueCustomers,
    returningCustomers,
    averageCustomerValue,
    topSpendingCustomers
  }
}

/**
 * Generate split payment analytics
 */
async function generateSplitPaymentAnalytics(filter: AnalyticsFilter): Promise<SplitPaymentAnalytics> {
  try {
    // Split payment functionality disabled - table payment_split_transactions doesn't exist
    console.log('Split payment analytics disabled - table not available')
    return {
      totalSplitTransactions: 0,
      totalSplitAmount: 0,
      splitsByStatus: {},
      topRecipients: [],
      splitHistory: []
    }
    
    /* DISABLED - table doesn't exist in current schema
    let splitQuery = supabase
      .from('payment_split_transactions')
      .select(`
        *,
        transaction:transactions!transaction_id (
          payment_link_id,
          created_at,
          payment_link:payment_links!payment_link_id (
            creator_id
          )
        )
      `)

    if (filter.creatorId) {
      splitQuery = splitQuery.eq('transaction.payment_link.creator_id', filter.creatorId)
    }

    if (filter.startDate) {
      splitQuery = splitQuery.gte('created_at', filter.startDate.toISOString())
    }

    if (filter.endDate) {
      splitQuery = splitQuery.lte('created_at', filter.endDate.toISOString())
    }

    const { data: splitTransactions, error: splitError } = await splitQuery

    if (splitError) {
      console.error('Error fetching split transactions:', splitError)
      // Return empty analytics if there's an error
      return {
        totalSplitPayments: 0,
        totalSplitRecipients: 0,
        averageRecipientsPerPayment: 0,
        totalDistributedAmount: 0,
        pendingDistributions: 0,
        failedDistributions: 0,
        topRecipients: [],
        splitsByType: []
      }
    }

    const splits = splitTransactions || []

    // Calculate basic metrics
    const totalSplitPayments = new Set(splits.map(s => s.transaction_id)).size
    const totalSplitRecipients = new Set(splits.map(s => s.recipient_email || s.recipient_user_id)).size
    const averageRecipientsPerPayment = totalSplitPayments > 0 ? splits.length / totalSplitPayments : 0
    const totalDistributedAmount = splits
      .filter(s => s.distribution_status === 'processed')
      .reduce((sum, s) => sum + s.split_amount_usd, 0)
    const pendingDistributions = splits.filter(s => s.distribution_status === 'pending').length
    const failedDistributions = splits.filter(s => s.distribution_status === 'failed').length

    // Generate top recipients
    const recipientMap = new Map<string, {
      email?: string
      name?: string
      userId?: string
      totalReceived: number
      transactionCount: number
      lastTransaction: string
    }>()

    splits.forEach(split => {
      const key = split.recipient_email || split.recipient_user_id || 'unknown'
      const existing = recipientMap.get(key) || {
        email: split.recipient_email,
        name: split.recipient_name,
        userId: split.recipient_user_id,
        totalReceived: 0,
        transactionCount: 0,
        lastTransaction: split.created_at
      }

      if (split.distribution_status === 'processed') {
        existing.totalReceived += split.split_amount_usd
      }
      existing.transactionCount += 1
      existing.lastTransaction = split.created_at

      recipientMap.set(key, existing)
    })

    const topRecipients: TopSplitRecipient[] = Array.from(recipientMap.values())
      .filter(r => r.totalReceived > 0)
      .sort((a, b) => b.totalReceived - a.totalReceived)
      .slice(0, 10)
      .map(recipient => ({
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        recipientUserId: recipient.userId,
        totalReceived: recipient.totalReceived,
        transactionCount: recipient.transactionCount,
        lastTransaction: recipient.lastTransaction
      }))

    // Generate splits by type breakdown
    const typeMap = new Map<'percentage' | 'fixed_amount', {
      count: number
      totalAmount: number
    }>()

    // We'll need to get the split recipients data to determine type
    let recipientsQuery = supabase
      .from('payment_split_recipients')
      .select(`
        split_type,
        payment_link_id,
        split_amount_fixed,
        split_percentage
      `)

    if (filter.creatorId) {
      recipientsQuery = recipientsQuery.eq('payment_link.creator_id', filter.creatorId)
    }

    const { data: splitRecipients } = await recipientsQuery

    const processedSplits = splits.filter(s => s.distribution_status === 'processed')
    
    processedSplits.forEach(split => {
      // For simplicity, we'll categorize based on whether there's a specific percentage
      const splitType = split.split_percentage_applied ? 'percentage' : 'fixed_amount'
      const existing = typeMap.get(splitType) || { count: 0, totalAmount: 0 }
      existing.count += 1
      existing.totalAmount += split.split_amount_usd
      typeMap.set(splitType, existing)
    })

    const splitsByType: SplitTypeBreakdown[] = Array.from(typeMap.entries()).map(([type, data]) => ({
      splitType: type,
      count: data.count,
      totalAmount: data.totalAmount,
      averageAmount: data.count > 0 ? data.totalAmount / data.count : 0
    }))

    return {
      totalSplitPayments,
      totalSplitRecipients,
      averageRecipientsPerPayment,
      totalDistributedAmount,
      pendingDistributions,
      failedDistributions,
      topRecipients,
      splitsByType
    }
  } catch (error) {
    console.error('Error generating split payment analytics:', error)
    return {
      totalSplitTransactions: 0,
      totalSplitAmount: 0,
      splitsByStatus: {},
      topRecipients: [],
      splitHistory: []
    }
  }
}

/**
 * Export analytics data to CSV
 */
export function exportAnalyticsToCSV(data: AnalyticsData): string {
  const csvRows = [
    ['Metric', 'Value'],
    ['Total Revenue', `$${data.totalRevenue.toFixed(2)}`],
    ['Total Transactions', data.totalTransactions.toString()],
    ['Success Rate', `${data.successRate.toFixed(2)}%`],
    ['Average Order Value', `$${data.averageOrderValue.toFixed(2)}`],
    ['Conversion Rate', `${data.conversionRate.conversionRate.toFixed(2)}%`],
    ['Usage Rate', `${data.conversionRate.usageRate.toFixed(2)}%`],
    ['Total Unique Customers', data.customerInsights.totalUniqueCustomers.toString()],
    ['Returning Customers', data.customerInsights.returningCustomers.toString()],
    ['Average Customer Value', `$${data.customerInsights.averageCustomerValue.toFixed(2)}`],
    [],
    ['Daily Revenue Data'],
    ['Date', 'Revenue', 'Transactions', 'Success Rate'],
    ...data.revenueByDay.map(day => [
      day.date,
      `$${day.revenue.toFixed(2)}`,
      day.transactions.toString(),
      `${day.successRate.toFixed(2)}%`
    ])
  ]
  
  return csvRows.map(row => row.join(',')).join('\n')
}

/**
 * Get real-time analytics updates
 */
export function subscribeToAnalyticsUpdates(callback: (data: AnalyticsData) => void, creatorId?: string) {
  const channel = supabase
    .channel('analytics-updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions'
      },
      async (payload) => {
        console.log('Real-time transaction update:', payload)
        try {
          // Refresh analytics data when transactions change
          const updatedData = await getAnalyticsData({ creatorId })
          callback(updatedData)
        } catch (error) {
          console.error('Error updating real-time analytics:', error)
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payment_links'
      },
      async (payload) => {
        console.log('Real-time payment link update:', payload)
        try {
          // Refresh analytics data when payment links change
          const updatedData = await getAnalyticsData({ creatorId })
          callback(updatedData)
        } catch (error) {
          console.error('Error updating real-time analytics:', error)
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'daily_analytics'
      },
      async (payload) => {
        console.log('Real-time daily analytics update:', payload)
        try {
          // Refresh analytics data when daily analytics change
          const updatedData = await getAnalyticsData({ creatorId })
          callback(updatedData)
        } catch (error) {
          console.error('Error updating real-time analytics:', error)
        }
      }
    )
    .subscribe((status) => {
      console.log('Analytics subscription status:', status)
    })
  
  return () => {
    console.log('Unsubscribing from analytics updates')
    supabase.removeChannel(channel)
  }
}

/**
 * Track analytics events
 */
export async function trackEvent(eventType: string, eventData: any = {}, paymentLinkId?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    const eventRecord = {
      user_id: session?.user?.id || null,
      event_type: eventType,
      event_data: eventData,
      payment_link_id: paymentLinkId || null,
      session_id: generateSessionId(),
      ip_address: await getClientIP(),
      user_agent: navigator.userAgent,
      referrer: document.referrer || null
    }
    
    const { error } = await supabase
      .from('analytics_events')
      .insert([eventRecord])
    
    if (error) {
      console.error('Error tracking event:', error)
    }
  } catch (error) {
    console.error('Error tracking analytics event:', error)
  }
}

/**
 * Generate session ID for tracking
 */
function generateSessionId(): string {
  // Check if we already have a session ID stored
  let sessionId = sessionStorage.getItem('decode_session_id')
  
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    sessionStorage.setItem('decode_session_id', sessionId)
  }
  
  return sessionId
}

/**
 * Get client IP address (placeholder - would need server-side implementation)
 */
async function getClientIP(): Promise<string | null> {
  try {
    // In a real implementation, you'd get this from the server or a service
    // For now, return null as we can't get real IP from client-side
    return null
  } catch {
    return null
  }
}

/**
 * Get enhanced analytics with geographic and customer insights
 */
export async function getEnhancedAnalytics(filter: AnalyticsFilter = {}): Promise<AnalyticsData & {
  geographicData: any[]
  topCountries: any[]
  customerSegments: any[]
}> {
  const baseAnalytics = await getAnalyticsData(filter)
  
  // Get geographic data
  const { data: geoData } = await supabase
    .from('geographic_analytics')
    .select(`
      country_code,
      country_name,
      transactions:transaction_id (
        amount_aed,
        status
      )
    `)
  
  // Get customer segments
  const { data: customerSegments } = await supabase
    .from('customer_insights')
    .select('customer_segment, customer_email, total_spent')
    .eq('user_id', filter.creatorId)
  
  const topCountries = geoData ? 
    Object.values(
      geoData.reduce((acc: any, item: any) => {
        if (!acc[item.country_code]) {
          acc[item.country_code] = {
            country: item.country_name,
            code: item.country_code,
            transactions: 0,
            revenue: 0
          }
        }
        if (item.transactions?.status === 'completed') {
          acc[item.country_code].transactions++
          acc[item.country_code].revenue += (item.transactions.amount_aed || 0)
        }
        return acc
      }, {})
    ).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5) : []
  
  return {
    ...baseAnalytics,
    geographicData: geoData || [],
    topCountries,
    customerSegments: customerSegments || []
  }
}

/**
 * Get daily analytics aggregates for faster loading
 */
export async function getDailyAnalytics(startDate: Date, endDate: Date, creatorId?: string) {
  let query = supabase
    .from('daily_analytics')
    .select('*')
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: true })
  
  if (creatorId) {
    query = query.eq('user_id', creatorId)
  }
  
  const { data, error } = await query
  
  if (error) {
    throw error
  }
  
  return data || []
}

/**
 * Export enhanced analytics to CSV with more details
 */
export function exportEnhancedAnalyticsToCSV(data: AnalyticsData, additionalData?: any): string {
  const csvRows = [
    ['DECODE Analytics Report'],
    ['Generated on', new Date().toLocaleString()],
    [],
    ['SUMMARY METRICS'],
    ['Metric', 'Value'],
    ['Total Revenue', `$${data.totalRevenue.toFixed(2)}`],
    ['Total Transactions', data.totalTransactions.toString()],
    ['Success Rate', `${data.successRate.toFixed(2)}%`],
    ['Average Order Value', `$${data.averageOrderValue.toFixed(2)}`],
    ['Conversion Rate', `${data.conversionRate.conversionRate.toFixed(2)}%`],
    ['Usage Rate', `${data.conversionRate.usageRate.toFixed(2)}%`],
    ['Total Unique Customers', data.customerInsights.totalUniqueCustomers.toString()],
    ['Returning Customers', data.customerInsights.returningCustomers.toString()],
    ['Average Customer Value', `$${data.customerInsights.averageCustomerValue.toFixed(2)}`],
    [],
    ['DAILY REVENUE DATA'],
    ['Date', 'Revenue', 'Transactions', 'Success Rate'],
    ...data.revenueByDay.map(day => [
      day.date,
      `$${day.revenue.toFixed(2)}`,
      day.transactions.toString(),
      `${day.successRate.toFixed(2)}%`
    ]),
    [],
    ['PAYMENT METHOD BREAKDOWN'],
    ['Method', 'Transactions', 'Percentage', 'Revenue'],
    ...data.paymentMethodBreakdown.map(method => [
      method.method,
      method.count.toString(),
      `${method.percentage.toFixed(2)}%`,
      `$${method.revenue.toFixed(2)}`
    ]),
    [],
    ['TOP SPENDING CUSTOMERS'],
    ['Email', 'Total Spent', 'Transactions', 'Last Transaction'],
    ...data.customerInsights.topSpendingCustomers.map(customer => [
      customer.email,
      `$${customer.totalSpent.toFixed(2)}`,
      customer.transactionCount.toString(),
      customer.lastTransaction
    ])
  ]
  
  return csvRows.map(row => 
    Array.isArray(row) ? row.map(cell => `"${cell}"`).join(',') : row
  ).join('\n')
}

/**
 * Get analytics data for a specific time period
 */
export async function getAnalyticsForPeriod(period: 'today' | 'week' | 'month' | 'quarter' | 'year', creatorId?: string): Promise<AnalyticsData> {
  const now = new Date()
  let startDate: Date
  let endDate: Date = now
  
  switch (period) {
    case 'today':
      startDate = startOfDay(now)
      endDate = endOfDay(now)
      break
    case 'week':
      startDate = startOfWeek(now)
      endDate = endOfWeek(now)
      break
    case 'month':
      startDate = startOfMonth(now)
      endDate = endOfMonth(now)
      break
    case 'quarter':
      startDate = subMonths(now, 3)
      break
    case 'year':
      startDate = subMonths(now, 12)
      break
    default:
      startDate = subDays(now, 30)
  }
  
  return generateAnalytics({ startDate, endDate, creatorId })
}

export async function generateAnalytics(filter: AnalyticsFilter): Promise<AnalyticsData> {
  try {
    // Only generate basic analytics, split functionality disabled
    const basicAnalytics = await generateBasicAnalytics(filter)

    return {
      ...basicAnalytics,
      // Split analytics disabled - return empty values
      totalSplitTransactions: 0,
      totalSplitAmount: 0,
      splitsByStatus: {},
      topRecipients: [],
      splitHistory: [],
      generatedAt: new Date()
    }
  } catch (error) {
    console.error('Error generating analytics:', error)
    
    // Return fallback empty analytics
    return {
      totalRevenue: 0,
      totalTransactions: 0,
      averageTransactionValue: 0,
      uniqueCustomers: 0,
      totalPaymentLinks: 0,
      activePaymentLinks: 0,
      conversionRate: 0,
      revenueByPeriod: [],
      topPaymentLinks: [],
      customerRetention: 0,
      totalSplitTransactions: 0,
      totalSplitAmount: 0,
      splitsByStatus: {},
      topRecipients: [],
      splitHistory: [],
      generatedAt: new Date()
    }
  }
}

export async function getAnalyticsData(filter: AnalyticsFilter): Promise<AnalyticsData> {
  return generateAnalytics(filter)
}