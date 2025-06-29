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
        <div className="mx-auto mb-8" style={{maxWidth: '3000px'}}>
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
        <div className="mx-auto mb-8" style={{maxWidth: '3000px'}}>
          <div className="cosmic-card">
            {/* Desktop Navigation */}
            <nav className="hidden md:flex gap-6 items-center">
              <Link 
                href="/dashboard" 
                className="px-6 py-3 text-white bg-purple-600 rounded-lg font-semibold shadow-lg hover:bg-purple-700 transition-colors"
              >
                Dashboard
              </Link>
              
              {userRole === 'Beauty Professional' && (
                <>
                  <Link 
                    href="/payment/create" 
                    className="px-6 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                  >
                    Create Payment Link
                  </Link>
                  <Link 
                    href="/my-links" 
                    className="px-6 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                  >
                    My Links
                  </Link>
                  <Link 
                    href="/dashboard/payments" 
                    className="px-6 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                  >
                    Payment History
                  </Link>
                </>
              )}
              
              <button 
                onClick={handleSignOut}
                className="px-6 py-3 text-gray-300 hover:text-white hover:bg-red-500/20 rounded-lg font-medium transition-colors ml-auto"
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
        <div className="mx-auto space-y-8" style={{maxWidth: '3000px'}}>
          
          {/* Welcome Card */}
          <div className="cosmic-card p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="lg:flex-1 lg:pr-8 mb-6 lg:mb-0">
                <h2 className="text-3xl font-bold mb-4 text-white">
                  Welcome back, {user?.email?.split('@')[0] || 'User'}!
                </h2>
                <p className="text-lg text-gray-300 mb-6 lg:mb-0">
                  Create payment links, manage transactions, and grow your beauty business with ease.
                </p>
              </div>
              
              <div className="lg:flex-shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 lg:min-w-[400px]">
                  <Link href="/payment/create" className="cosmic-button-primary text-center py-4 px-6 rounded-lg font-semibold text-lg hover:scale-105 transition-transform">
                    Create Payment Link
                  </Link>
                  <Link href="/dashboard/payments" className="cosmic-button-secondary border-2 border-white/40 rounded-lg py-4 px-6 font-semibold text-lg text-center block hover:scale-105 transition-transform">
                    View Payment History
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="cosmic-card stats-card text-center p-8">
              <div className="bg-green-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">Total Revenue</h3>
              <p className="text-4xl font-bold text-green-400">
                ${dashboardStats.totalRevenue.toFixed(2)}
              </p>
              <p className="text-sm text-gray-400 mt-2">All time earnings</p>
            </div>
            
            <div className="cosmic-card stats-card text-center p-8">
              <div className="bg-blue-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">Active Links</h3>
              <p className="text-4xl font-bold text-blue-400">
                {dashboardStats.activeLinks}
              </p>
              <p className="text-sm text-gray-400 mt-2">Currently accepting payments</p>
            </div>
            
            <div className="cosmic-card stats-card text-center p-8">
              <div className="bg-purple-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">Transactions</h3>
              <p className="text-4xl font-bold text-purple-400">
                {dashboardStats.totalTransactions}
              </p>
              <p className="text-sm text-gray-400 mt-2">Completed payments</p>
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