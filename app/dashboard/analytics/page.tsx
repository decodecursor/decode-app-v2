'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getAnalyticsData, getAnalyticsForPeriod, exportAnalyticsToCSV, subscribeToAnalyticsUpdates } from '@/lib/analytics'
import type { AnalyticsData } from '@/lib/analytics'
// Analytics components temporarily disabled due to schema mismatch
// import { RevenueChart, PaymentMethodBreakdown, ConversionRateTracker, CustomerInsights } from '@/components/analytics'
import Navigation from '@/components/Navigation'

type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all'

export default function AnalyticsPage() {
  const supabase = createClient()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month')
  const [user, setUser] = useState<any>(null)
  const [realtimeEnabled, setRealtimeEnabled] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/auth'
        return
      }
      setUser(session.user)
    }
    
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      fetchAnalyticsData()
    }
  }, [user, selectedPeriod])

  useEffect(() => {
    if (realtimeEnabled && user) {
      const unsubscribe = subscribeToAnalyticsUpdates((updatedData) => {
        setAnalyticsData(updatedData)
        console.log('Analytics updated in real-time')
      }, user.id)
      
      return unsubscribe
    }
    
    return () => {}
  }, [realtimeEnabled, user])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      setError('')
      
      let data: AnalyticsData
      if (selectedPeriod === 'all') {
        data = await getAnalyticsData({ creatorId: user.id })
      } else {
        data = await getAnalyticsForPeriod(selectedPeriod, user.id)
      }
      
      setAnalyticsData(data)
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError('Failed to load analytics data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (!analyticsData) return
    
    const csvData = exportAnalyticsToCSV(analyticsData)
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `analytics-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-500">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="sm:flex sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="mt-2 text-gray-600">Track your payment performance and customer insights</p>
            </div>
            <div className="mt-4 sm:mt-0 sm:flex sm:space-x-3">
              {/* Time Period Selector */}
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as TimePeriod)}
                className="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">Last 3 Months</option>
                <option value="year">Last 12 Months</option>
                <option value="all">All Time</option>
              </select>
              
              {/* Export Button */}
              <button
                onClick={handleExportCSV}
                disabled={!analyticsData}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
              
              {/* Real-time Toggle */}
              <button
                onClick={() => setRealtimeEnabled(!realtimeEnabled)}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                  realtimeEnabled 
                    ? 'text-white bg-green-600 hover:bg-green-700' 
                    : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${realtimeEnabled ? 'bg-white' : 'bg-gray-400'}`} />
                Real-time {realtimeEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading analytics</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
                <button 
                  onClick={fetchAnalyticsData}
                  className="mt-2 text-sm font-medium text-red-800 hover:text-red-900"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {loading ? (
                        <div className="animate-pulse bg-gray-200 h-6 w-20 rounded"></div>
                      ) : (
                        formatCurrency(analyticsData?.totalRevenue || 0)
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Transactions</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {loading ? (
                        <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                      ) : (
                        analyticsData?.totalTransactions || 0
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Success Rate</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {loading ? (
                        <div className="animate-pulse bg-gray-200 h-6 w-12 rounded"></div>
                      ) : (
                        formatPercentage(analyticsData?.successRate || 0)
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Avg Order Value</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {loading ? (
                        <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                      ) : (
                        formatCurrency(analyticsData?.averageOrderValue || 0)
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Revenue Chart */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Revenue Over Time</h2>
              <div className="flex space-x-2">
                <button className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Line</button>
                <button className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Bar</button>
              </div>
            </div>
            <div className="text-center py-8 text-gray-500">
              Revenue chart temporarily disabled - database migration required
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Payment Methods</h2>
            </div>
            <div className="text-center py-8 text-gray-500">
              Payment method breakdown temporarily disabled - database migration required
            </div>
          </div>
        </div>

        {/* Conversion Rate Tracker */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversion Tracking</h2>
          <div className="text-center py-8">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {loading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-20 rounded mx-auto"></div>
              ) : (
                `${analyticsData?.conversionRate.toFixed(2) || 0}%`
              )}
            </div>
            <div className="text-sm text-gray-500">Conversion Rate</div>
          </div>
        </div>

        {/* Customer Insights */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {loading ? (
                  <div className="animate-pulse bg-gray-200 h-8 w-16 rounded mx-auto"></div>
                ) : (
                  analyticsData?.customerInsights.totalUniqueCustomers || 0
                )}
              </div>
              <div className="text-sm text-gray-500">Total Customers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {loading ? (
                  <div className="animate-pulse bg-gray-200 h-8 w-16 rounded mx-auto"></div>
                ) : (
                  analyticsData?.customerInsights.returningCustomers || 0
                )}
              </div>
              <div className="text-sm text-gray-500">Returning Customers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {loading ? (
                  <div className="animate-pulse bg-gray-200 h-8 w-16 rounded mx-auto"></div>
                ) : (
                  `${analyticsData?.customerInsights.averageCustomerValue.toFixed(2) || 0} AED`
                )}
              </div>
              <div className="text-sm text-gray-500">Avg Customer Value</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}