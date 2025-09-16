import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

// Simple metrics collector for Prometheus
class MetricsCollector {
  private metrics: Map<string, number> = new Map()
  private counters: Map<string, number> = new Map()

  increment(name: string, value: number = 1, labels: Record<string, string> = {}) {
    const key = this.getMetricKey(name, labels)
    this.counters.set(key, (this.counters.get(key) || 0) + value)
  }

  gauge(name: string, value: number, labels: Record<string, string> = {}) {
    const key = this.getMetricKey(name, labels)
    this.metrics.set(key, value)
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
    return labelStr ? `${name}{${labelStr}}` : name
  }

  toPrometheusFormat(): string {
    const lines: string[] = []
    
    // Add counters
    for (const [key, value] of this.counters.entries()) {
      lines.push(`${key} ${value}`)
    }
    
    // Add gauges
    for (const [key, value] of this.metrics.entries()) {
      lines.push(`${key} ${value}`)
    }
    
    return lines.join('\n') + '\n'
  }
}

export async function GET(request: NextRequest) {
  try {
    const collector = new MetricsCollector()
    const now = Date.now()

    // Application uptime
    collector.gauge('decode_app_uptime_seconds', process.uptime())
    
    // Memory usage
    const memUsage = process.memoryUsage()
    collector.gauge('decode_app_memory_heap_used_bytes', memUsage.heapUsed)
    collector.gauge('decode_app_memory_heap_total_bytes', memUsage.heapTotal)
    collector.gauge('decode_app_memory_rss_bytes', memUsage.rss)

    // Database metrics
    try {
      const supabase = createServiceRoleClient()

      // Total users
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
      
      if (userCount !== null) {
        collector.gauge('decode_users_total', userCount)
      }

      // Total payment links
      const { count: paymentLinksCount } = await supabase
        .from('payment_links')
        .select('*', { count: 'exact', head: true })
      
      if (paymentLinksCount !== null) {
        collector.gauge('decode_payment_links_total', paymentLinksCount)
      }

      // Active payment links
      const { count: activeLinksCount } = await supabase
        .from('payment_links')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
      
      if (activeLinksCount !== null) {
        collector.gauge('decode_payment_links_active', activeLinksCount)
      }

      // Total transactions
      const { count: transactionsCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
      
      if (transactionsCount !== null) {
        collector.gauge('decode_transactions_total', transactionsCount)
      }

      // Transactions by status
      const { data: transactionsByStatus } = await supabase
        .from('transactions')
        .select('status')
        .not('status', 'is', null)

      if (transactionsByStatus) {
        const statusCounts = transactionsByStatus.reduce((acc: Record<string, number>, tx: any) => {
          acc[tx.status] = (acc[tx.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        for (const [status, count] of Object.entries(statusCounts)) {
          collector.gauge('decode_transactions_by_status', count as number, { status })
        }
      }

      // Revenue metrics (in AED - business currency)
      const { data: completedTransactions } = await supabase
        .from('transactions')
        .select('amount_aed, created_at')
        .eq('status', 'completed')

      if (completedTransactions) {
        const totalRevenue = completedTransactions.reduce((sum, tx) => sum + (tx.amount_aed || 0), 0)
        collector.gauge('decode_revenue_total_aed', totalRevenue)

        // Recent transactions (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const recentTransactions = completedTransactions.filter(
          tx => new Date(tx.created_at) > oneDayAgo
        )
        
        collector.gauge('decode_transactions_24h', recentTransactions.length)
        
        const recentRevenue = recentTransactions.reduce((sum, tx) => sum + (tx.amount_aed || 0), 0)
        collector.gauge('decode_revenue_24h_aed', recentRevenue)
      }

      // Split payment metrics - temporarily disabled until tables are properly set up
      // TODO: Re-enable when payment_split_transactions table exists in database types
      // 
      // const { count: splitTransactionsCount } = await supabase
      //   .from('payment_split_transactions')
      //   .select('*', { count: 'exact', head: true })
      // 
      // if (splitTransactionsCount !== null) {
      //   collector.gauge('decode_split_transactions_total', splitTransactionsCount)
      // }
      // 
      // const { data: splitTransactionsByStatus } = await supabase
      //   .from('payment_split_transactions')
      //   .select('distribution_status')
      //   .not('distribution_status', 'is', null)
      // 
      // if (splitTransactionsByStatus) {
      //   const splitStatusCounts = splitTransactionsByStatus.reduce((acc, tx) => {
      //     acc[tx.distribution_status] = (acc[tx.distribution_status] || 0) + 1
      //     return acc
      //   }, {} as Record<string, number>)
      // 
      //   for (const [status, count] of Object.entries(splitStatusCounts)) {
      //     collector.gauge('decode_split_distributions', count, { status })
      //   }
      // }

      // Database connection health
      collector.gauge('decode_database_connected', 1)

    } catch (dbError) {
      console.error('Database metrics collection failed:', dbError)
      collector.gauge('decode_database_connected', 0)
    }

    // Environment info
    collector.gauge('decode_app_info', 1, {
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      node_version: process.version
    })

    // Performance metrics
    const startTime = Date.now()
    
    // Generate response
    const metricsOutput = collector.toPrometheusFormat()
    
    const responseTime = Date.now() - startTime
    collector.gauge('decode_metrics_generation_duration_ms', responseTime)

    return new NextResponse(metricsOutput, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Metrics endpoint error:', error)
    
    const errorCollector = new MetricsCollector()
    errorCollector.gauge('decode_metrics_error', 1)
    errorCollector.gauge('decode_app_uptime_seconds', process.uptime())
    
    return new NextResponse(errorCollector.toPrometheusFormat(), {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
      }
    })
  }
}