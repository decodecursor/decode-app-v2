// Global type definitions for DECODE application

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Next.js environment
      NODE_ENV: 'development' | 'production' | 'test'
      NEXT_PUBLIC_APP_URL: string
      NEXT_PUBLIC_SITE_URL: string
      NEXT_PUBLIC_APP_NAME: string
      NEXT_PUBLIC_APP_VERSION: string

      // Supabase configuration
      NEXT_PUBLIC_SUPABASE_URL: string
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string
      SUPABASE_SERVICE_ROLE_KEY: string

      // Crossmint configuration
      NEXT_PUBLIC_CROSSMINT_PROJECT_ID: string
      NEXT_PUBLIC_CROSSMINT_API_KEY: string
      CROSSMINT_API_KEY: string
      CROSSMINT_WEBHOOK_SECRET: string
      CROSSMINT_ENVIRONMENT: 'staging' | 'production'
      NEXT_PUBLIC_CROSSMINT_ENVIRONMENT: 'staging' | 'production'

      // Database configuration
      DATABASE_URL: string
      DATABASE_POOL_MIN?: string
      DATABASE_POOL_MAX?: string
      DATABASE_TIMEOUT?: string

      // Security configuration
      JWT_SECRET: string
      NEXTAUTH_SECRET: string
      NEXTAUTH_URL: string
      SESSION_TIMEOUT?: string
      CSRF_SECRET?: string

      // Email configuration
      EMAIL_PROVIDER: 'resend' | 'sendgrid' | 'ses'
      EMAIL_API_KEY?: string
      RESEND_API_KEY?: string
      EMAIL_FROM: string
      SUPPORT_EMAIL: string
      DEBUG_EMAIL?: string

      // SMTP configuration (alternative)
      SMTP_HOST?: string
      SMTP_PORT?: string
      SMTP_USER?: string
      SMTP_PASS?: string
      SMTP_SECURE?: string

      // Storage configuration
      STORAGE_PROVIDER?: 'aws-s3' | 'local'
      AWS_ACCESS_KEY_ID?: string
      AWS_SECRET_ACCESS_KEY?: string
      AWS_REGION?: string
      AWS_S3_BUCKET?: string

      // Monitoring and logging
      SENTRY_DSN?: string
      SENTRY_ENVIRONMENT?: string
      SENTRY_RELEASE?: string
      LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error'
      LOG_FORMAT?: 'json' | 'text'
      LOG_FILE?: string

      // Analytics
      GOOGLE_ANALYTICS_ID?: string
      MIXPANEL_TOKEN?: string

      // Rate limiting
      RATE_LIMIT_WINDOW?: string
      RATE_LIMIT_MAX_REQUESTS?: string
      RATE_LIMIT_PAYMENT_WINDOW?: string
      RATE_LIMIT_PAYMENT_MAX?: string

      // Webhook configuration
      WEBHOOK_TIMEOUT?: string
      WEBHOOK_RETRY_ATTEMPTS?: string
      WEBHOOK_RETRY_DELAY?: string

      // Performance configuration
      REDIS_URL?: string
      REDIS_PASSWORD?: string
      CACHE_TTL?: string
      SESSION_STORE?: string
      CDN_URL?: string
      ASSETS_URL?: string

      // Payment configuration
      PAYMENT_TIMEOUT?: string
      PAYMENT_RETRY_ATTEMPTS?: string
      MINIMUM_PAYMENT_AMOUNT?: string
      MAXIMUM_PAYMENT_AMOUNT?: string
      DEFAULT_PLATFORM_FEE_PERCENTAGE?: string
      PAYMENT_PROCESSING_FEE?: string

      // Feature flags
      FEATURE_PAYMENT_SPLITTING?: string
      FEATURE_ANALYTICS_DASHBOARD?: string
      FEATURE_MOBILE_PAYMENTS?: string
      FEATURE_EMAIL_NOTIFICATIONS?: string
      FEATURE_REAL_TIME_UPDATES?: string

      // Backup configuration
      BACKUP_SCHEDULE?: string
      BACKUP_RETENTION_DAYS?: string
      BACKUP_STORAGE_BUCKET?: string

      // Compliance and security
      SECURITY_HEADERS_ENABLED?: string
      CONTENT_SECURITY_POLICY_ENABLED?: string
      FORCE_HTTPS?: string
      HSTS_MAX_AGE?: string
      GDPR_COMPLIANCE_ENABLED?: string
      DATA_RETENTION_DAYS?: string
      COOKIE_CONSENT_REQUIRED?: string

      // Notification configuration
      ALERT_EMAIL?: string
      SLACK_WEBHOOK_URL?: string
      ALERT_THRESHOLD_ERROR_RATE?: string
      ALERT_THRESHOLD_RESPONSE_TIME?: string

      // External services
      SUPPORT_DESK_URL?: string
      DOCUMENTATION_URL?: string
      STATUS_PAGE_URL?: string

      // Build configuration
      BUILD_ID?: string
      CUSTOM_KEY?: string
    }
  }

  // Window interface extensions
  interface Window {
    // Crossmint SDK
    CrossmintEmbeddedCheckout?: any
    CrossmintPayButton?: any
    
    // Analytics
    gtag?: (...args: any[]) => void
    mixpanel?: any
    
    // Development tools
    __DECODE_DEBUG__?: boolean
  }

  // Custom events
  interface CustomEventMap {
    'payment:success': CustomEvent<{ transactionId: string; amount: number }>
    'payment:failed': CustomEvent<{ error: string; code?: string }>
    'payment:cancelled': CustomEvent<{ reason?: string }>
    'split:created': CustomEvent<{ splitId: string; recipients: number }>
    'split:distributed': CustomEvent<{ splitId: string; amount: number }>
  }

  interface Document {
    addEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void
    ): void
    removeEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void
    ): void
    dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K]): void
  }
}

// Module augmentation for external libraries
declare module '@crossmint/client-sdk-react-ui' {
  export interface CrossmintProviderProps {
    apiKey: string
    environment: 'staging' | 'production'
    children: React.ReactNode
  }
  
  export const CrossmintProvider: React.FC<CrossmintProviderProps>
  export const CrossmintPayButton: React.FC<any>
  export const CrossmintEmbeddedCheckout: React.FC<any>
}

declare module 'recharts' {
  // Add specific recharts type definitions if needed
  export * from 'recharts/types/component/DefaultLegendContent'
  export * from 'recharts/types/component/DefaultTooltipContent'
}

// Utility types for DECODE
export type NonEmptyArray<T> = [T, ...T[]]

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type SplitType = 'percentage' | 'fixed_amount'

export type RecipientType = 'platform_user' | 'external_email' | 'platform_fee'

export type DistributionStatus = 'pending' | 'processed' | 'failed' | 'cancelled'

export type UserRole = 'user' | 'admin' | 'creator'

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year'

export type NotificationLevel = 'info' | 'warning' | 'error' | 'critical'

export {}