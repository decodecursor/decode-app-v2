/**
 * Logger utility for consistent logging across the application
 * Only logs in development mode unless explicitly enabled
 */

const isDevelopment = process.env.NODE_ENV === 'development'
const isDebugEnabled = process.env.DEBUG === 'true'

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment || isDebugEnabled) {
      console.log(...args)
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors
    console.error(...args)
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment || isDebugEnabled) {
      console.warn(...args)
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment || isDebugEnabled) {
      console.log('[DEBUG]', ...args)
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment || isDebugEnabled) {
      console.info(...args)
    }
  },
  
  // Production-safe logging for important events
  event: (eventName: string, data?: any) => {
    if (isDevelopment) {
      console.log(`[EVENT] ${eventName}`, data)
    }
    // In production, this could send to analytics or monitoring service
  },
  
  // Webhook-specific logging
  webhook: (event: string, data?: any) => {
    if (isDevelopment || process.env.DEBUG_WEBHOOKS === 'true') {
      console.log(`[WEBHOOK] ${event}`, data)
    }
  }
}