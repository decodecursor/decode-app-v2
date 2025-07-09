/**
 * Crossmint Components Index
 * 
 * Export all Crossmint payment components for easy importing
 */

// Removed unused components: CrossmintHeadlessCheckout, CrossmintPaymentButton

export { CrossmintProvider, useCrossmint, CrossmintConfigStatus } from './CrossmintProvider'

export { 
  PaymentStatus, 
  PaymentLoading, 
  PaymentSuccess, 
  PaymentError 
} from './PaymentStatus'
export type { PaymentStatusType } from './PaymentStatus'

// Re-export configuration
export { crossmintConfig, validateCrossmintConfig } from '@/lib/crossmint-config'