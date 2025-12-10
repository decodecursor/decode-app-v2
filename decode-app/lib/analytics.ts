// Simplified analytics for deployment - complex features disabled due to schema mismatch
// Using API route to avoid client-side Supabase service role key exposure

export interface AnalyticsFilter {
  startDate?: Date
  endDate?: Date
  creatorId?: string
}

export interface ConversionRate {
  paymentLinksCreated: number
  paymentLinksUsed: number
  usageRate: number
  conversionRate: number
  totalPayments: number
}

export interface TopCustomer {
  email: string
  totalSpent: number
  transactionCount: number
  lastTransactionDate?: string
  status?: string
}

export interface CustomerInsights {
  totalUniqueCustomers: number
  returningCustomers: number
  averageCustomerValue: number
  topSpendingCustomers?: TopCustomer[]
}

export interface PaymentMethodBreakdown {
  method: string
  count: number
  percentage: number
  revenue: number
}

export interface RevenueByDay {
  date: string
  revenue: number
  transactions: number
  successRate: number
}

export interface AnalyticsData {
  totalRevenue: number
  totalTransactions: number
  averageTransactionValue: number
  uniqueCustomers: number
  totalPaymentLinks: number
  activePaymentLinks: number
  conversionRate: number
  revenueByPeriod: Array<{
    period: string
    revenue: number
    transactions: number
  }>
  topPaymentLinks: Array<{
    id: string
    title: string
    revenue: number
    transactions: number
  }>
  customerRetention: number
  totalSplitTransactions: number
  totalSplitAmount: number
  splitsByStatus: Record<string, number>
  topRecipients: Array<{
    identifier: string
    email?: string
    totalAmount: number
    totalTransactions: number
  }>
  splitHistory: Array<{
    date: string
    amount: number
    status: string
  }>
  generatedAt: Date
  // Additional properties for analytics page compatibility
  successRate: number
  averageOrderValue: number
  revenueByDay: Array<{
    date: string
    revenue: number
    transactions: number
    successRate: number
  }>
  paymentMethodBreakdown: Array<{
    method: string
    count: number
    percentage: number
  }>
  customerInsights: {
    totalUniqueCustomers: number
    returningCustomers: number
    averageCustomerValue: number
  }
}

export async function generateAnalytics(filter: AnalyticsFilter): Promise<AnalyticsData> {
  try {
    // Only generate basic analytics, split functionality disabled
    const basicAnalytics = await generateBasicAnalytics(filter)

    return {
      // Ensure all required fields have default values
      totalRevenue: basicAnalytics.totalRevenue || 0,
      totalTransactions: basicAnalytics.totalTransactions || 0,
      averageTransactionValue: basicAnalytics.averageTransactionValue || 0,
      uniqueCustomers: basicAnalytics.uniqueCustomers || 0,
      totalPaymentLinks: basicAnalytics.totalPaymentLinks || 0,
      activePaymentLinks: basicAnalytics.activePaymentLinks || 0,
      conversionRate: basicAnalytics.conversionRate || 0,
      revenueByPeriod: basicAnalytics.revenueByPeriod || [],
      topPaymentLinks: basicAnalytics.topPaymentLinks || [],
      customerRetention: basicAnalytics.customerRetention || 0,
      // Split analytics disabled - return empty values
      totalSplitTransactions: 0,
      totalSplitAmount: 0,
      splitsByStatus: {},
      topRecipients: [],
      splitHistory: [],
      generatedAt: new Date(),
      // Additional properties for analytics page compatibility
      successRate: basicAnalytics.conversionRate || 0,
      averageOrderValue: basicAnalytics.averageTransactionValue || 0,
      revenueByDay: [],
      paymentMethodBreakdown: [],
      customerInsights: {
        totalUniqueCustomers: basicAnalytics.uniqueCustomers || 0,
        returningCustomers: 0,
        averageCustomerValue: basicAnalytics.averageTransactionValue || 0
      }
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
      generatedAt: new Date(),
      // Additional properties for analytics page compatibility
      successRate: 0,
      averageOrderValue: 0,
      revenueByDay: [],
      paymentMethodBreakdown: [],
      customerInsights: {
        totalUniqueCustomers: 0,
        returningCustomers: 0,
        averageCustomerValue: 0
      }
    }
  }
}

async function generateBasicAnalytics(filter: AnalyticsFilter): Promise<Partial<AnalyticsData>> {
  try {
    // Call the server-side API route instead of querying directly
    const response = await fetch('/api/analytics/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        startDate: filter.startDate?.toISOString(),
        endDate: filter.endDate?.toISOString(),
        creatorId: filter.creatorId
      })
    })

    if (!response.ok) {
      throw new Error(`Analytics API failed with status ${response.status}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error('Analytics API returned unsuccessful response')
    }

    return result.data
  } catch (error) {
    console.error('Error in basic analytics:', error)
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
      customerRetention: 0
    }
  }
}

export async function getAnalyticsData(filter: AnalyticsFilter): Promise<AnalyticsData> {
  return generateAnalytics(filter)
}

export async function getAnalyticsForPeriod(period: 'today' | 'week' | 'month' | 'quarter' | 'year', creatorId?: string): Promise<AnalyticsData> {
  const now = new Date()
  let startDate: Date
  let endDate: Date = now
  
  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'quarter':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
  
  return generateAnalytics({ startDate, endDate, creatorId })
}

export function exportAnalyticsToCSV(data: AnalyticsData): string {
  return `Metric,Value
Total Revenue,${data.totalRevenue} AED
Total Transactions,${data.totalTransactions}
Average Transaction Value,${data.averageTransactionValue} AED
Unique Customers,${data.uniqueCustomers}
Total Payment Links,${data.totalPaymentLinks}
Active Payment Links,${data.activePaymentLinks}
Conversion Rate,${data.conversionRate}%
Note: Full analytics disabled due to database schema migration required`
}

export function subscribeToAnalyticsUpdates(callback: (data: AnalyticsData) => void, creatorId?: string) {
  console.log('Real-time analytics updates disabled - schema migration required')
  return () => {} // Return empty unsubscribe function
}