// Simplified analytics for deployment - complex features disabled due to schema mismatch
import { supabase } from './supabase'

export interface AnalyticsFilter {
  startDate?: Date
  endDate?: Date
  creatorId?: string
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

async function generateBasicAnalytics(filter: AnalyticsFilter): Promise<Partial<AnalyticsData>> {
  try {
    // Basic queries using available database schema
    let transactionsQuery = supabase
      .from('transactions')
      .select('*')

    let paymentLinksQuery = supabase
      .from('payment_links')
      .select('*')

    if (filter.creatorId) {
      paymentLinksQuery = paymentLinksQuery.eq('creator_id', filter.creatorId)
    }

    if (filter.startDate) {
      transactionsQuery = transactionsQuery.gte('created_at', filter.startDate.toISOString())
    }

    if (filter.endDate) {
      transactionsQuery = transactionsQuery.lte('created_at', filter.endDate.toISOString())
    }

    const [transactionsResult, paymentLinksResult] = await Promise.all([
      transactionsQuery,
      paymentLinksQuery
    ])

    const transactions = transactionsResult.data || []
    const paymentLinks = paymentLinksResult.data || []

    // Calculate basic metrics
    const totalRevenue = transactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount_aed, 0)

    const totalTransactions = transactions.filter(t => t.status === 'completed').length
    const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
    const uniqueCustomers = new Set(transactions.map(t => t.buyer_email).filter(Boolean)).size
    const totalPaymentLinks = paymentLinks.length
    const activePaymentLinks = paymentLinks.filter(pl => pl.is_active).length
    const conversionRate = totalPaymentLinks > 0 ? (totalTransactions / totalPaymentLinks) * 100 : 0

    return {
      totalRevenue,
      totalTransactions,
      averageTransactionValue,
      uniqueCustomers,
      totalPaymentLinks,
      activePaymentLinks,
      conversionRate,
      revenueByPeriod: [],
      topPaymentLinks: [],
      customerRetention: 0
    }
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