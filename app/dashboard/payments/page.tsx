'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import PaymentLinkCard from '@/components/dashboard/PaymentLinkCard'
import PaymentStats from '@/components/dashboard/PaymentStats'

interface PaymentLink {
  id: string
  title: string
  description: string | null
  amount_usd: number
  expiration_date: string
  is_active: boolean
  created_at: string
  creator: {
    full_name: string | null
    email: string
  }
  transaction_count: number
  total_revenue: number
}

interface PaymentTransaction {
  id: string
  amount_usd: number
  status: string
  created_at: string
  payment_link: {
    title: string
    amount_usd: number
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'amount_usd' | 'total_revenue'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showStats, setShowStats] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUser(user)
      await fetchPaymentData(user.id)
    }
    
    getUser()
  }, [])

  const fetchPaymentData = async (userId: string) => {
    try {
      setLoading(true)
      setError('')

      // Fetch payment links with transaction counts and revenue
      const { data: linksData, error: linksError } = await supabase
        .from('payment_links')
        .select(`
          id,
          title,
          description,
          amount_usd,
          expiration_date,
          is_active,
          created_at,
          creator:creator_id (
            full_name,
            email
          ),
          transactions (
            id,
            amount_usd,
            status
          )
        `)
        .eq('creator_id', userId)
        .order('created_at', { ascending: false })

      if (linksError) throw linksError

      // Process the data to include transaction counts and revenue
      const processedLinks: PaymentLink[] = (linksData || []).map(link => {
        const transactions = link.transactions || []
        const completedTransactions = transactions.filter(t => t.status === 'completed')
        
        return {
          ...link,
          creator: Array.isArray(link.creator) ? (link.creator[0] || { full_name: null, email: '' }) : (link.creator || { full_name: null, email: '' }),
          transaction_count: completedTransactions.length,
          total_revenue: completedTransactions.reduce((sum, t) => sum + (t.amount_usd || 0), 0)
        }
      })

      setPaymentLinks(processedLinks)

      // Fetch all transactions with payment link details
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select(`
          id,
          amount_usd,
          status,
          created_at,
          payment_link:payment_link_id (
            title,
            amount_usd
          )
        `)
        .in('payment_link_id', processedLinks.map(link => link.id))
        .order('created_at', { ascending: false })

      const processedTransactions: PaymentTransaction[] = (transactionsData || [])
        .filter(t => t.payment_link)
        .map(t => ({
          ...t,
          payment_link: Array.isArray(t.payment_link) ? (t.payment_link[0] || { title: '', amount_usd: 0 }) : (t.payment_link || { title: '', amount_usd: 0 })
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

    } catch (error) {
      console.error('Error fetching payment data:', error)
      setError('Failed to load payment data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
        case 'amount_usd':
          aValue = a.amount_usd
          bValue = b.amount_usd
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
      currency: 'USD'
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

  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="cosmic-card">
            <div className="animate-pulse">
              <div className="h-8 bg-white/20 rounded mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-white/20 rounded w-3/4"></div>
                <div className="h-4 bg-white/20 rounded w-1/2"></div>
              </div>
            </div>
          </div>
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
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="cosmic-card mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="cosmic-logo text-2xl text-white mb-2">Payment History</h1>
              <p className="cosmic-body text-white/70">
                Track your payment links and revenue analytics
              </p>
            </div>
            <Link href="/dashboard" className="cosmic-button-secondary">
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="cosmic-card text-center">
              <h3 className="cosmic-label text-white/70 mb-2">Total Revenue</h3>
              <p className="text-3xl font-bold text-green-400">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
            
            <div className="cosmic-card text-center">
              <h3 className="cosmic-label text-white/70 mb-2">Active Links</h3>
              <p className="text-3xl font-bold text-blue-400">
                {stats.activeLinks}
              </p>
            </div>
            
            <div className="cosmic-card text-center">
              <h3 className="cosmic-label text-white/70 mb-2">Total Transactions</h3>
              <p className="text-3xl font-bold text-purple-400">
                {stats.totalTransactions}
              </p>
            </div>
            
            <div className="cosmic-card text-center">
              <h3 className="cosmic-label text-white/70 mb-2">Average Payment</h3>
              <p className="text-3xl font-bold text-yellow-400">
                {formatCurrency(stats.averagePayment)}
              </p>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="cosmic-card mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="cosmic-label text-white/70 block mb-2">Search</label>
              <input
                type="text"
                placeholder="Search payment links..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="cosmic-input"
              />
            </div>
            
            <div>
              <label className="cosmic-label text-white/70 block mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="cosmic-input"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            
            <div>
              <label className="cosmic-label text-white/70 block mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'created_at' | 'amount_usd' | 'total_revenue')}
                className="cosmic-input"
              >
                <option value="created_at">Date Created</option>
                <option value="amount_usd">Amount</option>
                <option value="total_revenue">Revenue</option>
              </select>
            </div>
            
            <div>
              <label className="cosmic-label text-white/70 block mb-2">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="cosmic-input"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Analytics */}
        {showStats && transactions.length > 0 && (
          <div className="mb-8">
            <PaymentStats 
              transactions={transactions}
              paymentLinks={filteredAndSortedLinks}
            />
          </div>
        )}

        {/* Toggle Analytics Button */}
        {transactions.length > 0 && (
          <div className="cosmic-card mb-8 text-center">
            <button
              onClick={() => setShowStats(!showStats)}
              className="cosmic-button-secondary"
            >
              {showStats ? 'Hide Analytics' : 'Show Analytics'}
            </button>
          </div>
        )}

        {/* Payment Links List */}
        <div className="space-y-4">
          {filteredAndSortedLinks.length === 0 ? (
            <div className="cosmic-card text-center py-12">
              <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h3 className="cosmic-heading text-white mb-2">No Payment Links Found</h3>
              <p className="cosmic-body text-white/70 mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No payment links match your current filters.'
                  : 'You haven\'t created any payment links yet.'
                }
              </p>
              <Link href="/payment/create" className="cosmic-button-primary">
                Create Your First Payment Link
              </Link>
            </div>
          ) : (
            filteredAndSortedLinks.map((link) => (
              <PaymentLinkCard
                key={link.id}
                {...link}
                onCopyLink={copyPaymentLink}
              />
            ))
          )}
        </div>

        {/* Pagination could be added here for large datasets */}
        {filteredAndSortedLinks.length > 0 && (
          <div className="cosmic-card mt-8 text-center">
            <p className="cosmic-body text-white/70">
              Showing {filteredAndSortedLinks.length} of {paymentLinks.length} payment links
            </p>
          </div>
        )}
      </div>
    </div>
  )
}