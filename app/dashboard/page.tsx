'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dashboardStats, setDashboardStats] = useState({
    totalRevenue: 0,
    activeLinks: 0,
    totalTransactions: 0
  })

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUser(user)
      
      // Fetch user role from users table
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (userData) {
        setUserRole(userData.role)
      }
      
      // Fetch dashboard stats
      await fetchDashboardStats(user.id)
      
      setLoading(false)
    }
    
    getUser()
  }, [])

  const fetchDashboardStats = async (userId: string) => {
    try {
      // Fetch payment links with transaction data
      const { data: linksData } = await supabase
        .from('payment_links')
        .select(`
          id,
          amount_usd,
          is_active,
          transactions (
            id,
            amount_usd,
            status
          )
        `)
        .eq('creator_id', userId)

      if (linksData) {
        const activeLinks = linksData.filter(link => link.is_active).length
        
        let totalRevenue = 0
        let totalTransactions = 0
        
        linksData.forEach(link => {
          const completedTransactions = (link.transactions || []).filter(t => t.status === 'completed')
          totalTransactions += completedTransactions.length
          totalRevenue += completedTransactions.reduce((sum, t) => sum + (t.amount_usd || 0), 0)
        })
        
        setDashboardStats({
          totalRevenue,
          activeLinks,
          totalTransactions
        })
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      window.location.href = '/auth'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen px-4 py-8">
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-8">
          <div className="cosmic-card">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h1 className="cosmic-logo text-2xl">DECODE</h1>
                <div className="hidden md:block">
                  <p className="cosmic-body text-white text-sm">Beauty Payment Platform</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* User Info */}
                <div className="text-right">
                  <p className="text-white text-sm font-medium">
                    {user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {user?.email}
                  </p>
                  {userRole && (
                    <p className="text-purple-400 text-xs">
                      {userRole}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="max-w-6xl mx-auto mb-8">
          <div className="cosmic-card">
            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-4">
              <Link 
                href="/dashboard" 
                className="px-4 py-2 text-white bg-purple-600 rounded-lg font-medium"
              >
                Dashboard
              </Link>
              
              {userRole === 'Beauty Professional' && (
                <>
                  <Link 
                    href="/payment/create" 
                    className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                  >
                    Create Payment Link
                  </Link>
                  <Link 
                    href="/my-links" 
                    className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                  >
                    My Links
                  </Link>
                  <Link 
                    href="/dashboard/payments" 
                    className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                  >
                    Payment History
                  </Link>
                </>
              )}
              
              <button 
                onClick={handleSignOut}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-red-500/20 rounded-lg font-medium transition-colors ml-auto"
              >
                Logout
              </button>
            </nav>

            {/* Mobile Navigation */}
            <div className="md:hidden">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex items-center justify-between w-full p-4 text-white"
              >
                <span className="font-medium">Menu</span>
                <svg 
                  className={`w-5 h-5 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {mobileMenuOpen && (
                <div className="border-t border-gray-700 pt-4">
                  <nav className="space-y-2">
                    <Link 
                      href="/dashboard" 
                      className="block px-4 py-3 text-white bg-purple-600 rounded-lg font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    
                    {userRole === 'Beauty Professional' && (
                      <>
                        <Link 
                          href="/payment/create" 
                          className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Create Payment Link
                        </Link>
                        <Link 
                          href="/my-links" 
                          className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          My Links
                        </Link>
                        <Link 
                          href="/dashboard/payments" 
                          className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Payment History
                        </Link>
                      </>
                    )}
                    
                    <button 
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-3 text-gray-300 hover:text-white hover:bg-red-500/20 rounded-lg font-medium transition-colors"
                    >
                      Logout
                    </button>
                  </nav>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Dashboard Content */}
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Welcome Card */}
          <div className="cosmic-card">
            <h2 className="cosmic-heading mb-4 text-white">
              Welcome back, {user?.email?.split('@')[0] || 'User'}!
            </h2>
            <p className="cosmic-body mb-8 text-white">
              Create payment links, manage transactions, and grow your beauty business with ease.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link href="/payment/create" className="cosmic-button-primary text-center py-4 rounded-lg font-medium">
                Create Payment Link
              </Link>
              <Link href="/dashboard/payments" className="cosmic-button-secondary border border-white/40 rounded-lg py-4 font-medium text-center block">
                View Payment History
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="cosmic-card text-center">
              <h3 className="cosmic-label mb-3 text-white">Total Revenue</h3>
              <p className="cosmic-heading text-3xl font-semibold text-green-400">
                ${dashboardStats.totalRevenue.toFixed(2)}
              </p>
            </div>
            
            <div className="cosmic-card text-center">
              <h3 className="cosmic-label mb-3 text-white">Active Links</h3>
              <p className="cosmic-heading text-3xl font-semibold text-blue-400">
                {dashboardStats.activeLinks}
              </p>
            </div>
            
            <div className="cosmic-card text-center">
              <h3 className="cosmic-label mb-3 text-white">Transactions</h3>
              <p className="cosmic-heading text-3xl font-semibold text-purple-400">
                {dashboardStats.totalTransactions}
              </p>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="cosmic-card">
            <h2 className="cosmic-heading mb-4 text-white">Recent Activity</h2>
            <div className="text-center py-8">
              <p className="cosmic-body text-white">No transactions yet</p>
              <p className="cosmic-body text-white text-sm mt-2">
                Create your first payment link to get started
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}