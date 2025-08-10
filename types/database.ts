// Supabase Database Type Definitions
// Generated based on current database schema for DECODE Beauty Platform

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          user_name: string
          professional_center_name: string | null
          instagram_handle: string | null
          wallet_address: string | null
          role: string
          company_name: string
          terms_accepted_at: string | null
          created_at: string
          crossmint_wallet_id: string | null
          wallet_created_at: string | null
          stripe_connect_account_id: string | null
          stripe_connect_status: string | null
          stripe_onboarding_completed: boolean | null
          stripe_payouts_enabled: boolean | null
          stripe_charges_enabled: boolean | null
          stripe_details_submitted: boolean | null
          stripe_capabilities: Json | null
          stripe_requirements: Json | null
        }
        Insert: {
          id?: string
          email: string
          user_name: string
          professional_center_name?: string | null
          instagram_handle?: string | null
          wallet_address?: string | null
          role: string
          company_name: string
          terms_accepted_at?: string | null
          created_at?: string
          crossmint_wallet_id?: string | null
          wallet_created_at?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_status?: string | null
          stripe_onboarding_completed?: boolean | null
          stripe_payouts_enabled?: boolean | null
          stripe_charges_enabled?: boolean | null
          stripe_details_submitted?: boolean | null
          stripe_capabilities?: Json | null
          stripe_requirements?: Json | null
        }
        Update: {
          id?: string
          email?: string
          user_name?: string
          professional_center_name?: string | null
          instagram_handle?: string | null
          wallet_address?: string | null
          role?: string
          company_name?: string
          terms_accepted_at?: string | null
          created_at?: string
          crossmint_wallet_id?: string | null
          wallet_created_at?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_status?: string | null
          stripe_onboarding_completed?: boolean | null
          stripe_payouts_enabled?: boolean | null
          stripe_charges_enabled?: boolean | null
          stripe_details_submitted?: boolean | null
          stripe_capabilities?: Json | null
          stripe_requirements?: Json | null
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          id: string
          title: string
          description: string | null
          amount_aed: number
          expiration_date: string
          creator_id: string
          linked_user_id: string | null
          is_active: boolean
          created_at: string
          client_name: string | null
          payment_status: 'unpaid' | 'paid' | 'failed' | 'refunded'
          paid_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          amount_aed: number
          expiration_date: string
          creator_id: string
          linked_user_id?: string | null
          is_active?: boolean
          created_at?: string
          client_name?: string | null
          payment_status?: 'unpaid' | 'paid' | 'failed' | 'refunded'
          paid_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          amount_aed?: number
          expiration_date?: string
          creator_id?: string
          linked_user_id?: string | null
          is_active?: boolean
          created_at?: string
          client_name?: string | null
          payment_status?: 'unpaid' | 'paid' | 'failed' | 'refunded'
          paid_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      transactions: {
        Row: {
          id: string
          payment_link_id: string
          buyer_email: string | null
          buyer_name: string | null
          amount_aed: number
          amount_usd: number | null
          status: string
          payment_processor: string
          processor_transaction_id: string | null
          processor_session_id: string | null
          processor_payment_id: string | null
          payment_method_type: string | null
          metadata: Json
          completed_at: string | null
          failed_at: string | null
          cancelled_at: string | null
          refunded_at: string | null
          expired_at: string | null
          failure_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          payment_link_id: string
          buyer_email?: string | null
          buyer_name?: string | null
          amount_aed: number
          amount_usd?: number | null
          status?: string
          payment_processor?: string
          processor_transaction_id?: string | null
          processor_session_id?: string | null
          processor_payment_id?: string | null
          payment_method_type?: string | null
          metadata?: Json
          completed_at?: string | null
          failed_at?: string | null
          cancelled_at?: string | null
          refunded_at?: string | null
          expired_at?: string | null
          failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          payment_link_id?: string
          buyer_email?: string | null
          buyer_name?: string | null
          amount_aed?: number
          amount_usd?: number | null
          status?: string
          payment_processor?: string
          processor_transaction_id?: string | null
          processor_session_id?: string | null
          processor_payment_id?: string | null
          payment_method_type?: string | null
          metadata?: Json
          completed_at?: string | null
          failed_at?: string | null
          cancelled_at?: string | null
          refunded_at?: string | null
          expired_at?: string | null
          failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          }
        ]
      }
      webhook_events: {
        Row: {
          id: string
          event_id: string | null
          event_type: string
          event_data: Json
          payment_link_id: string | null
          signature: string | null
          timestamp: string
          status: string
          error_message: string | null
          processed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id?: string | null
          event_type: string
          event_data: Json
          payment_link_id?: string | null
          signature?: string | null
          timestamp: string
          status: string
          error_message?: string | null
          processed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string | null
          event_type?: string
          event_data?: Json
          payment_link_id?: string | null
          signature?: string | null
          timestamp?: string
          status?: string
          error_message?: string | null
          processed_at?: string
          created_at?: string
        }
        Relationships: []
      }
      user_bank_accounts: {
        Row: {
          id: string
          user_id: string
          iban_number: string
          bank_name: string
          beneficiary_name: string
          is_primary: boolean
          is_verified: boolean
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          iban_number: string
          bank_name: string
          beneficiary_name: string
          is_primary?: boolean
          is_verified?: boolean
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          iban_number?: string
          bank_name?: string
          beneficiary_name?: string
          is_primary?: boolean
          is_verified?: boolean
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      wallet_transactions: {
        Row: {
          id: string
          user_id: string
          payment_link_id: string | null
          transaction_type: string
          amount_usdc: number | null
          amount_aed: number | null
          status: string
          crossmint_transaction_id: string | null
          crossmint_session_id: string | null
          metadata: Json | null
          created_at: string
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          payment_link_id?: string | null
          transaction_type: string
          amount_usdc?: number | null
          amount_aed?: number | null
          status: string
          crossmint_transaction_id?: string | null
          crossmint_session_id?: string | null
          metadata?: Json | null
          created_at?: string
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          payment_link_id?: string | null
          transaction_type?: string
          amount_usdc?: number | null
          amount_aed?: number | null
          status?: string
          crossmint_transaction_id?: string | null
          crossmint_session_id?: string | null
          metadata?: Json | null
          created_at?: string
          completed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          }
        ]
      }
      payouts: {
        Row: {
          id: string
          user_id: string
          stripe_payout_id: string
          amount_aed: number
          currency: string
          status: string
          arrival_date: string | null
          payment_id: string | null
          metadata: Json | null
          period_start: string | null
          period_end: string | null
          scheduled_for: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_payout_id: string
          amount_aed: number
          currency?: string
          status?: string
          arrival_date?: string | null
          payment_id?: string | null
          metadata?: Json | null
          period_start?: string | null
          period_end?: string | null
          scheduled_for?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_payout_id?: string
          amount_aed?: number
          currency?: string
          status?: string
          arrival_date?: string | null
          payment_id?: string | null
          metadata?: Json | null
          period_start?: string | null
          period_end?: string | null
          scheduled_for?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      transfers: {
        Row: {
          id: string
          user_id: string
          payment_id: string
          amount_aed: number
          stripe_connect_account_id: string
          stripe_transfer_id: string | null
          status: string
          failure_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          payment_id: string
          amount_aed: number
          stripe_connect_account_id: string
          stripe_transfer_id?: string | null
          status?: string
          failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          payment_id?: string
          amount_aed?: number
          stripe_connect_account_id?: string
          stripe_transfer_id?: string | null
          status?: string
          failure_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for common database operations
export type PaymentLinkRow = Database['public']['Tables']['payment_links']['Row']
export type PaymentLinkInsert = Database['public']['Tables']['payment_links']['Insert']
export type PaymentLinkUpdate = Database['public']['Tables']['payment_links']['Update']

export type UserRow = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type TransactionRow = Database['public']['Tables']['transactions']['Row']
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update']

export type WebhookEventRow = Database['public']['Tables']['webhook_events']['Row']
export type WebhookEventInsert = Database['public']['Tables']['webhook_events']['Insert']
export type WebhookEventUpdate = Database['public']['Tables']['webhook_events']['Update']

export type UserBankAccountRow = Database['public']['Tables']['user_bank_accounts']['Row']
export type UserBankAccountInsert = Database['public']['Tables']['user_bank_accounts']['Insert']
export type UserBankAccountUpdate = Database['public']['Tables']['user_bank_accounts']['Update']

export type WalletTransactionRow = Database['public']['Tables']['wallet_transactions']['Row']
export type WalletTransactionInsert = Database['public']['Tables']['wallet_transactions']['Insert']
export type WalletTransactionUpdate = Database['public']['Tables']['wallet_transactions']['Update']

export type PayoutRow = Database['public']['Tables']['payouts']['Row']
export type PayoutInsert = Database['public']['Tables']['payouts']['Insert']
export type PayoutUpdate = Database['public']['Tables']['payouts']['Update']

export type TransferRow = Database['public']['Tables']['transfers']['Row']
export type TransferInsert = Database['public']['Tables']['transfers']['Insert']
export type TransferUpdate = Database['public']['Tables']['transfers']['Update']

// Extended types for queries with relations
export type PaymentLinkWithCreator = PaymentLinkRow & {
  creator: UserRow
}

export type PaymentLinkWithTransactions = PaymentLinkRow & {
  transactions: TransactionRow[]
}

export type PaymentLinkWithCreatorAndTransactions = PaymentLinkRow & {
  creator: UserRow
  transactions: TransactionRow[]
}

export type TransactionWithPaymentLink = TransactionRow & {
  payment_link: PaymentLinkRow
}

// Status enums
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'expired'
export type PaymentProcessor = 'stripe' | 'crossmint'
export type WebhookStatus = 'received' | 'processed' | 'failed' | 'unhandled'
export type UserRole = 'Admin' | 'User'