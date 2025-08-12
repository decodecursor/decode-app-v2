'use client'

import { useState, useEffect } from 'react'

// Cache-busting debug log to verify new code is loading
console.log('🚀 PAYMENTS PAGE LOADED - VERSION 2024-01-05-16:30 - NEW CODE ACTIVE!')
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import PaymentLinkCard from '@/components/dashboard/PaymentLinkCard'
import PaymentStats from '@/components/dashboard/PaymentStats'

interface PaymentLink {
  id: string
  title: string
  description: string | null
  amount_aed: number
  service_amount_aed: number | null
  client_name: string | null
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
  const [user, setUser] = useState<User | null>(null)
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
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined)

  console.log('🔄 PaymentHistoryPage render - user:', user?.id, 'paymentLinks:', paymentLinks.length, 'loading:', loading, 'error:', error)

  // Load date range from localStorage on component mount
  useEffect(() => {
    try {
      console.log('📱 Loading localStorage data...')
      const savedDateRange = localStorage.getItem('paymentAnalyticsDateRange')
      const savedCustomRange = localStorage.getItem('paymentAnalyticsCustomRange')
      
      if (savedDateRange) {
        setDateRange(savedDateRange as 'today' | 'week' | 'month' | 'custom')
      }
      
      if (savedCustomRange) {
        const parsed = JSON.parse(savedCustomRange)
        if (parsed.from) parsed.from = new Date(parsed.from)
        if (parsed.to) parsed.to = new Date(parsed.to)
        setCustomDateRange(parsed)
      }
      console.log('✅ localStorage data loaded successfully')
    } catch (error) {
      console.error('❌ Error loading localStorage data:', error)
      // Clear corrupted data
      localStorage.removeItem('paymentAnalyticsDateRange')
      localStorage.removeItem('paymentAnalyticsCustomRange')
    }
  }, [])

  // Save date range to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('paymentAnalyticsDateRange', dateRange)
    } catch (error) {
      console.error('❌ Error saving dateRange to localStorage:', error)
    }
  }, [dateRange])

  useEffect(() => {
    try {
      localStorage.setItem('paymentAnalyticsCustomRange', JSON.stringify(customDateRange))
    } catch (error) {
      console.error('❌ Error saving customDateRange to localStorage:', error)
    }
  }, [customDateRange])

  useEffect(() => {
    const getUser = async () => {
      console.log('🔐 Starting authentication check...')
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        console.log('🔐 Auth response - user:', user?.id, 'error:', error)
        
        if (!user) {
          console.log('❌ No authenticated user found - redirecting to /auth')
          window.location.href = '/auth'
          return
        }
        
        console.log('✅ User authenticated:', user.id)
        setUser(user)
        await fetchPaymentData(user.id)
      } catch (error: any) {
        console.error('❌ Authentication error:', error)
        setError('Authentication failed. Please try logging in again.')
      }
    }
    
    getUser()
  }, [])

  const fetchPaymentData = async (userId: string) => {
    try {
      console.log('🔍 Starting fetchPaymentData for user:', userId)
      setLoading(true)
      setError('')

      // Simple query for payment links with paid_at column
      console.log('🔍 Fetching payment links with paid_at field...')
      
      const { data: linksData, error: linksError } = await supabase
        .from('payment_links')
        .select(`
          id,
          title,
          description,
          amount_aed,
          service_amount_aed,
          client_name,
          expiration_date,
          is_active,
          created_at,
          paid_at,
          creator:creator_id (
            user_name,
            email
          ),
          transactions (
            id,
            amount_aed,
            status,
            created_at,
            completed_at
          )
        `)
        .eq('creator_id', userId)
        .not('paid_at', 'is', null) // Only get paid payment links
        .order('paid_at', { ascending: false })

      if (linksError) {
        console.error('❌ Payment links query failed:', linksError)
        throw linksError
      }
      
      console.log('💰 Found', linksData?.length || 0, 'paid payment links')

      // Simple processing: if paid_at exists, it's paid
      const processedLinks: PaymentLink[] = (linksData || [])
        .map((link: any) => {
          const transactions = link.transactions || []
          const completedTransactions = transactions.filter((t: any) => t.status === 'completed')
          
          return {
            ...link,
            creator: Array.isArray(link.creator) ? (link.creator[0] || { user_name: null, email: '' }) : (link.creator || { user_name: null, email: '' }),
            transaction_count: completedTransactions.length,
            total_revenue: completedTransactions.reduce((sum: number, t: any) => sum + (t.amount_aed || 0), 0)
          }
        })

      setPaymentLinks(processedLinks)

      // Fetch all transactions for paid payment links only
      let transactionsData: any[] = []
      if (processedLinks.length > 0) {
        const { data } = await supabase
          .from('transactions')
          .select(`
            id,
            amount_aed,
            status,
            created_at,
            completed_at,
            payment_link:payment_link_id (
              title,
              amount_aed,
              client_name
            )
          `)
          .in('payment_link_id', processedLinks.map(link => link.id))
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
        
        transactionsData = data || []
      }

      const processedTransactions: PaymentTransaction[] = (transactionsData || [])
        .filter(t => t.payment_link)
        .map(t => ({
          ...t,
          payment_link: Array.isArray(t.payment_link) ? (t.payment_link[0] || { title: '', amount_aed: 0 }) : (t.payment_link || { title: '', amount_aed: 0 })
        }))

      setTransactions(processedTransactions)

      // Calculate stats
      const totalRevenue = processedLinks.reduce((sum, link) => sum + link.total_revenue, 0)
      const activeLinks = processedLinks.filter(link => link.is_active).length
      const totalTransactions = processedLinks.reduce((sum, link) => sum + link.transaction_count, 0)
      
      // Get this month's data
      const now = new Date()
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      
      const thisMonthLinks = processedLinks.filter(link => 
        new Date(link.created_at) >= thisMonthStart
      )
      const thisMonthRevenue = thisMonthLinks.reduce((sum, link) => sum + link.total_revenue, 0)
      const thisMonthTransactions = thisMonthLinks.reduce((sum, link) => sum + link.transaction_count, 0)

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

    } catch (error: any) {
      console.error('❌ DETAILED ERROR in fetchPaymentData:')
      console.error('Error object:', error)
      console.error('Error message:', error?.message)
      console.error('Error stack:', error?.stack)
      console.error('Full error details:', JSON.stringify(error, null, 2))
      setError(`Database error: ${error?.message || 'Unknown error'}`)
    } finally {
      console.log('✅ Finished fetchPaymentData')
      setLoading(false)
    }
  }

  // Set up real-time subscription for payment completion events
  useEffect(() => {
    if (!user) return

    const subscription = supabase
      .channel('payment-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
          filter: `status=eq.completed`
        },
        async (payload) => {
          console.log('✅ Payment completed in real-time (transaction):', payload)
          
          const transaction = payload.new as any
          const paymentLinkId = transaction.payment_link_id
          
          if (paymentLinkId) {
            // Check if this payment link belongs to current user
            const currentUserLinks = paymentLinks.map(link => link.id)
            if (currentUserLinks.includes(paymentLinkId)) {
              // Trigger heart animation for this payment link
              setHeartAnimationLinks(prev => new Set([...prev, paymentLinkId]))
              
              // Remove animation after 3 seconds
              setTimeout(() => {
                setHeartAnimationLinks(prev => {
                  const newSet = new Set(prev)
                  newSet.delete(paymentLinkId)
                  return newSet
                })
              }, 3000)
              
              // Refresh payment data to show updated stats
              await fetchPaymentData(user.id)
            }
          }
        }
      )
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
            // Trigger heart animation for this payment link
            setHeartAnimationLinks(prev => new Set([...prev, paymentLink.id]))
            
            // Remove animation after 3 seconds
            setTimeout(() => {
              setHeartAnimationLinks(prev => {
                const newSet = new Set(prev)
                newSet.delete(paymentLink.id)
                return newSet
              })
            }, 3000)
            
            // Refresh payment data to show updated stats
            await fetchPaymentData(user.id)
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user, paymentLinks])

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
    const link = `${window.location.origin}/pay/${linkId}`
    try {
      await navigator.clipboard.writeText(link)
      // You could add a toast notification here
      console.log('Payment link copied to clipboard')
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  console.log('🎯 ABOUT TO CHECK USER STATE - user:', user, 'typeof user:', typeof user)
  
  // Show loading state while authenticating or if no user
  if (!user) {
    console.log('🔄 LOADING STATE TRIGGERED - user is undefined, showing loading screen')
    return (
      <div style={{ 
        backgroundColor: '#1a1a1a', 
        minHeight: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        color: 'white',
        fontSize: '24px',
        fontFamily: 'Arial'
      }}>
        <div style={{
          backgroundColor: '#333',
          padding: '40px',
          borderRadius: '10px',
          textAlign: 'center'
        }}>
          <div>🔄 LOADING DASHBOARD...</div>
          <div style={{fontSize: '16px', marginTop: '10px'}}>Authenticating user...</div>
        </div>
      </div>
    )
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

  return (
    <div className="cosmic-bg min-h-screen">
      <div className="min-h-screen px-4 py-8">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <div style={{width: '70vw'}}>
            {/* Back to Dashboard Link */}
            <Link 
              href="/dashboard" 
              className="inline-flex items-center text-gray-300 hover:text-white transition-colors payment-back-button mb-6"
              onClick={(e) => {
                console.log('Back to Dashboard clicked from analytics/payments page');
                e.preventDefault();
                window.location.href = '/dashboard';
              }}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>Back to Dashboard
            </Link>
            
            <div className="cosmic-card">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="cosmic-heading mb-2">Earnings</h1>
              </div>
              <Link 
                href="/payment/create" 
                className="bg-gradient-to-br from-gray-800 to-black text-white border-none rounded-lg text-[17px] font-medium px-6 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-gray-600 hover:to-gray-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] inline-block"
              >
                Create PayLink
              </Link>
            </div>
          </div>
        </div>



        {/* Analytics */}
        <div className="flex justify-center">
          <div style={{width: '70vw'}}>
            <PaymentStats 
              transactions={transactions}
              paymentLinks={filteredAndSortedLinks}
              user={user}
            />
          </div>
        </div>

      </div>
    </div>
  )
}