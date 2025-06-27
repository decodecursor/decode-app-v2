// DECODE Production Monitoring and Alerting Library

export interface AlertConfig {
  webhookUrl?: string
  slackChannel?: string
  emailRecipients?: string[]
  severity: 'info' | 'warning' | 'error' | 'critical'
}

export interface MonitoringEvent {
  type: 'payment_failure' | 'system_error' | 'performance_issue' | 'security_alert' | 'business_metric'
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  metadata?: Record<string, any>
  timestamp?: Date
}

class MonitoringService {
  private config: AlertConfig

  constructor(config: AlertConfig) {
    this.config = config
  }

  /**
   * Send alert notification
   */
  async sendAlert(event: MonitoringEvent): Promise<void> {
    const alert = {
      ...event,
      timestamp: event.timestamp || new Date(),
      environment: process.env.NODE_ENV,
      application: 'DECODE'
    }

    try {
      // Send to multiple channels based on severity
      const promises: Promise<any>[] = []

      // Always log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('🚨 MONITORING ALERT:', alert)
      }

      // Send to Slack if configured
      if (this.config.slackChannel && this.config.webhookUrl) {
        promises.push(this.sendSlackAlert(alert))
      }

      // Send email alerts for critical issues
      if (this.config.emailRecipients && alert.severity === 'critical') {
        promises.push(this.sendEmailAlert(alert))
      }

      // Send to external webhook
      if (this.config.webhookUrl) {
        promises.push(this.sendWebhookAlert(alert))
      }

      await Promise.allSettled(promises)

    } catch (error) {
      console.error('Failed to send monitoring alert:', error)
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackAlert(alert: MonitoringEvent & { timestamp: Date; environment: string; application: string }): Promise<void> {
    if (!this.config.webhookUrl) return

    const color = this.getSeverityColor(alert.severity)
    const emoji = this.getSeverityEmoji(alert.severity)

    const slackPayload = {
      channel: this.config.slackChannel,
      username: 'DECODE Monitor',
      icon_emoji: ':warning:',
      attachments: [
        {
          color,
          title: `${emoji} ${alert.title}`,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Environment',
              value: alert.environment,
              short: true
            },
            {
              title: 'Type',
              value: alert.type,
              short: true
            },
            {
              title: 'Timestamp',
              value: alert.timestamp.toISOString(),
              short: true
            }
          ],
          footer: 'DECODE Monitoring System',
          ts: Math.floor(alert.timestamp.getTime() / 1000)
        }
      ]
    }

    // Add metadata if present
    if (alert.metadata && Object.keys(alert.metadata).length > 0) {
      slackPayload.attachments[0].fields.push({
        title: 'Metadata',
        value: '```' + JSON.stringify(alert.metadata, null, 2) + '```',
        short: false
      })
    }

    await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload)
    })
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: MonitoringEvent & { timestamp: Date; environment: string; application: string }): Promise<void> {
    // This would integrate with your email service (SendGrid, SES, etc.)
    console.log('Email alert would be sent to:', this.config.emailRecipients)
    
    // Implementation would depend on your email service
    // For now, we'll just log the alert that would be sent
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: MonitoringEvent & { timestamp: Date; environment: string; application: string }): Promise<void> {
    if (!this.config.webhookUrl) return

    await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert)
    })
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#FF0000'
      case 'error': return '#FF6600'
      case 'warning': return '#FFCC00'
      case 'info': return '#0099FF'
      default: return '#808080'
    }
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '📋'
    }
  }
}

// Singleton monitoring service instance
let monitoringService: MonitoringService | null = null

export function getMonitoringService(): MonitoringService {
  if (!monitoringService) {
    const config: AlertConfig = {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      slackChannel: process.env.SLACK_ALERT_CHANNEL || '#decode-alerts',
      emailRecipients: process.env.ALERT_EMAIL?.split(',') || ['admin@decode.beauty'],
      severity: 'info'
    }
    
    monitoringService = new MonitoringService(config)
  }
  
  return monitoringService
}

/**
 * Quick alert functions for common scenarios
 */
export async function alertPaymentFailure(transactionId: string, error: string, metadata?: any): Promise<void> {
  const monitoring = getMonitoringService()
  await monitoring.sendAlert({
    type: 'payment_failure',
    severity: 'critical',
    title: 'Payment Processing Failure',
    message: `Payment transaction ${transactionId} failed: ${error}`,
    metadata: { transactionId, error, ...metadata }
  })
}

export async function alertSystemError(error: string, metadata?: any): Promise<void> {
  const monitoring = getMonitoringService()
  await monitoring.sendAlert({
    type: 'system_error',
    severity: 'error',
    title: 'System Error Detected',
    message: error,
    metadata
  })
}

export async function alertPerformanceIssue(metric: string, value: number, threshold: number, metadata?: any): Promise<void> {
  const monitoring = getMonitoringService()
  await monitoring.sendAlert({
    type: 'performance_issue',
    severity: 'warning',
    title: 'Performance Threshold Exceeded',
    message: `${metric} is ${value} (threshold: ${threshold})`,
    metadata: { metric, value, threshold, ...metadata }
  })
}

export async function alertSecurityEvent(event: string, metadata?: any): Promise<void> {
  const monitoring = getMonitoringService()
  await monitoring.sendAlert({
    type: 'security_alert',
    severity: 'critical',
    title: 'Security Event Detected',
    message: event,
    metadata
  })
}

export async function alertBusinessMetric(metric: string, message: string, metadata?: any): Promise<void> {
  const monitoring = getMonitoringService()
  await monitoring.sendAlert({
    type: 'business_metric',
    severity: 'info',
    title: `Business Metric Alert: ${metric}`,
    message,
    metadata
  })
}

/**
 * Performance monitoring middleware
 */
export function createPerformanceMonitor() {
  const startTime = Date.now()
  
  return {
    end: async (operationName: string, metadata?: any) => {
      const duration = Date.now() - startTime
      
      // Alert if operation takes too long
      if (duration > 5000) { // 5 seconds threshold
        await alertPerformanceIssue(
          'operation_duration',
          duration,
          5000,
          { operationName, ...metadata }
        )
      }
      
      return duration
    }
  }
}

/**
 * Error tracking decorator
 */
export function trackErrors<T extends (...args: any[]) => any>(
  fn: T,
  operationName: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      await alertSystemError(
        `Error in ${operationName}: ${error instanceof Error ? error.message : String(error)}`,
        { 
          operationName, 
          stack: error instanceof Error ? error.stack : undefined,
          args: args.length > 0 ? args : undefined
        }
      )
      throw error
    }
  }) as T
}

/**
 * Rate limiting monitoring
 */
export async function alertRateLimitExceeded(clientId: string, endpoint: string, attempts: number): Promise<void> {
  await alertSecurityEvent(
    `Rate limit exceeded for client ${clientId} on ${endpoint}`,
    { clientId, endpoint, attempts }
  )
}

/**
 * Database monitoring
 */
export async function alertDatabaseIssue(operation: string, error: string, metadata?: any): Promise<void> {
  await alertSystemError(
    `Database operation failed: ${operation} - ${error}`,
    { operation, ...metadata }
  )
}

/**
 * Payment split monitoring
 */
export async function alertSplitDistributionFailure(
  transactionId: string, 
  recipientId: string, 
  error: string, 
  metadata?: any
): Promise<void> {
  await alertPaymentFailure(
    transactionId,
    `Split distribution failed for recipient ${recipientId}: ${error}`,
    { recipientId, ...metadata }
  )
}

/**
 * Business metrics tracking
 */
export async function trackRevenueAnomaly(
  currentRevenue: number, 
  expectedRevenue: number, 
  period: string
): Promise<void> {
  const difference = Math.abs(currentRevenue - expectedRevenue)
  const percentDiff = (difference / expectedRevenue) * 100
  
  if (percentDiff > 20) { // 20% threshold
    await alertBusinessMetric(
      'revenue_anomaly',
      `Revenue anomaly detected for ${period}: $${currentRevenue} vs expected $${expectedRevenue} (${percentDiff.toFixed(1)}% difference)`,
      { currentRevenue, expectedRevenue, period, percentDiff }
    )
  }
}