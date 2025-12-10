'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Cache-busting debug log to verify new code is loading
console.log('🚀 PAYMENTS PAGE LOADED - VERSION 2024-01-05-16:30 - NEW CODE ACTIVE!')
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
import { useUser } from '@/providers/UserContext'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import PaymentLinkCard from '@/components/dashboard/PaymentLinkCard'
import PaymentStats from '@/components/dashboard/PaymentStats'
import { USER_ROLES, normalizeRole, UserRole } from '@/types/user'

interface PaymentLink {
  id: string
  title: string
  description: string | null
  amount_aed: number
  service_amount_aed: number | null
  client_name: string | null
  creator_id: string
  expiration_date: string
  is_active: boolean
  created_at: string
  paid_at: string | null
  creator: {
    user_name: string | null
    email: string
  }
  transaction_count: number
  total_revenue: number
  company_name: string | null
  branch_name: string | null
  creator_name: string | null
  payment_status: string | null
  paymentlink_request_id: string | null
}

interface PaymentTransaction {
  id: string
  amount_aed: number
  status: string
  created_at: string
  completed_at: string | null
  payment_link: {
    title: string
    amount_aed: number
    client_name: string | null
  }
}

interface PaymentStats {
  totalRevenue: number
  activeLinks: number
  totalTransactions: number
  successfulPayments: number
  averagePayment: number
  thisMonth: {
    revenue: number
    transactions: number
  }
}

export default function PaymentHistoryPage() {
  const supabase = createClient()
  const router = useRouter()
  const { user: contextUser, profile } = useUser()
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(profile?.role || null)
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([])
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'amount_aed' | 'total_revenue'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [heartAnimationLinks, setHeartAnimationLinks] = useState<Set<string>>(new Set())

  console.log('🔄 PaymentHistoryPage render - user:', user?.id, 'userRole:', userRole, 'paymentLinks:', paymentLinks.length, 'loading:', loading, 'error:', error)

  const fetchPaymentData = async (userId: string) => {
    try {
      console.log('🔍 Starting fetchPaymentData for user:', userId)
      setLoading(true)
      setError('')

      // Fetch payment history data via proxy endpoint
      console.log('🔍 Fetching payment history via proxy...')

      const response = await fetch('/api/payment-history/data', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Payment history fetch failed:', errorData)
        console.error('❌ Response status:', response.status)
        console.error('❌ Response statusText:', response.statusText)
        throw new Error(`API Error (${response.status}): ${errorData.error || 'Failed to fetch payment history'}`)
      }

      const data = await response.json()
      console.log('✅ Payment history API response received:', data)

      const { paymentLinks: processedLinks, transactions: processedTransactions, stats: fetchedStats } = data

      console.log('💰 Found', processedLinks?.length || 0, 'paid payment links')
      console.log('💳 Found', processedTransactions?.length || 0, 'transactions')
      console.log('📊 Stats:', fetchedStats)

      // Log details about payment links for debugging
      if (processedLinks && processedLinks.length > 0) {
        console.log('📊 Sample payment link data:')
        processedLinks.slice(0, 3).forEach((link: any, i: number) => {
          console.log(`  Link ${i + 1}:`, {
            id: link.id,
            title: link.title,
            amount_aed: link.amount_aed,
            service_amount_aed: link.service_amount_aed,
            transaction_count: link.transaction_count,
            total_revenue: link.total_revenue,
            paid_at: link.paid_at
          })
        })
      }

      setPaymentLinks(processedLinks || [])
      setTransactions(processedTransactions || [])

      // Use stats from proxy endpoint or calculate fallback
      if (fetchedStats) {
        setStats(fetchedStats)
      } else {
        // Fallback calculation if stats not provided
        const totalRevenue = processedLinks.reduce((sum: any, link: any) => sum + link.total_revenue, 0)
        const activeLinks = processedLinks.filter((link: any) => link.is_active).length
        const totalTransactions = processedLinks.reduce((sum: any, link: any) => sum + link.transaction_count, 0)

        // Get this month's data
        const now = new Date()
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

        const thisMonthLinks = processedLinks.filter((link: any) =>
          new Date(link.created_at) >= thisMonthStart
        )
        const thisMonthRevenue = thisMonthLinks.reduce((sum: any, link: any) => sum + link.total_revenue, 0)
        const thisMonthTransactions = thisMonthLinks.reduce((sum: any, link: any) => sum + link.transaction_count, 0)

        setStats({
          totalRevenue,
          activeLinks,
          totalTransactions,
          successfulPayments: totalTransactions,
          averagePayment: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
          thisMonth: {
            revenue: thisMonthRevenue,
            transactions: thisMonthTransactions
          }
        })
      }

    } catch (error: any) {
      console.error('❌ DETAILED ERROR in fetchPaymentData:')
      console.error('Error object:', error)
      console.error('Error message:', error?.message)
      console.error('Error stack:', error?.stack)
      console.error('Full error details:', JSON.stringify(error, null, 2))
      setError(`Database error: ${error?.message || 'Unknown error'}`)
    } finally {
      console.log('✅ Finished fetchPaymentData - setting loading to false')
      setLoading(false)
      console.log('✅ Loading state updated - component should render now')
    }
  }

  // Sync userRole from UserContext profile (instant, no API call needed)
  useEffect(() => {
    if (profile?.role) {
      console.log('🔍 [PAYMENTS] Using role from UserContext:', profile.role)
      setUserRole(profile.role)
    }
  }, [profile])

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        console.error('Error fetching user profile:', await response.text())
        return
      }

      const { userData } = await response.json()
      const normalizedRole = normalizeRole(userData.role)
      console.log('🔍 [PAYMENTS DEBUG] Raw role:', userData.role, 'Normalized role:', normalizedRole)
      setUserRole(normalizedRole)
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  // Simple authentication and data loading (like my-links)
  useEffect(() => {
    const getUser = async () => {
      try {
        const { user } = await getUserWithProxy()
        if (!user) {
          router.push('/auth')
          return
        }

        console.log('✅ Payments: User authenticated:', user.id)
        setUser(user)
        // Run data fetching in parallel for faster load
        await Promise.all([
          fetchPaymentData(user.id),
          fetchUserRole()
        ])

        // Set up real-time subscription for payment completion events
        console.log('🔄 Setting up real-time subscription for user:', user.id)
        const subscription = supabase
          .channel('payment-updates')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'payment_links',
              filter: `creator_id=eq.${user.id}`
            },
            async (payload) => {
              console.log('✅ Payment link status updated in real-time:', payload)

              const paymentLink = payload.new as any
              const oldPaymentLink = payload.old as any

              // Check if payment_status changed to 'paid'
              if (paymentLink.payment_status === 'paid' && oldPaymentLink.payment_status !== 'paid') {
                console.log('💖 Payment completed! Triggering update for:', paymentLink.id)

                // Refresh payment data to show updated stats
                await fetchPaymentData(user.id)
              }
            }
          )
          .subscribe()
      } catch (error) {
        console.error('❌ Authentication or data loading failed:', error)
        // Don't set error state - just log it
        setLoading(false)
      }
    }
    getUser()
  }, [])

  const filteredAndSortedLinks = paymentLinks
    .filter(link => {
      const matchesSearch = link.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           link.description?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || 
                           (statusFilter === 'active' && link.is_active) ||
                           (statusFilter === 'inactive' && !link.is_active)
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'amount_aed':
          aValue = a.amount_aed
          bValue = b.amount_aed
          break
        case 'total_revenue':
          aValue = a.total_revenue
          bValue = b.total_revenue
          break
        default:
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'AED'
    }).format(amount)
  }

  const copyPaymentLink = async (linkId: string) => {
    const link = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/pay/${linkId}`
    try {
      await navigator.clipboard.writeText(link)
      // You could add a toast notification here
      console.log('Payment link copied to clipboard')
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  if (error) {
    return (
      <div className="cosmic-bg min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="cosmic-card text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="cosmic-heading text-white mb-2">Error Loading Data</h2>
            <p className="cosmic-body text-white/70 mb-4">{error}</p>
            <button 
              onClick={() => user && fetchPaymentData(user.id)}
              className="cosmic-button-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main component return
  return (
    <div className="cosmic-bg min-h-screen">
      <div className="min-h-screen px-4 py-4 md:py-8">
        {/* Back to Dashboard Button - Above Header */}
        <div className="flex justify-start md:justify-center dashboard-back-button-spacing">
          <div className="w-full px-4 md:w-[70vw] md:px-0 payments-back-button">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>Back
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-center mb-6 md:mb-0">
          <div className="payments-container payments-container-mobile">
            <div className="cosmic-card">
              <div className="flex md:flex-row md:justify-between md:items-center payments-header-mobile">
                <div>
                  <h1 className="cosmic-heading mb-2 md:mb-2">Earnings</h1>
                </div>
                <Link
                  href="/payment/create"
                  className="bg-gradient-to-br from-gray-800 to-black text-white border-none rounded-lg text-[17px] font-medium px-6 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-gray-600 hover:to-gray-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] inline-block create-paylink-button-mobile"
                >
                  Create PayLink
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div className="flex justify-center">
          <div className="payments-container payments-container-mobile">
            <PaymentStats
              transactions={transactions}
              paymentLinks={paymentLinks}
              user={user}
              userRole={userRole}
            />
          </div>
        </div>

      </div>
    </div>
  )
}