'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useUser } from '@/providers/UserContext'
import { USER_ROLES } from '@/types/user'

type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all'

interface ModelAnalytics {
  // Core metrics requested
  totalFundsCollected: number
  beautyServicesRevenue: number
  totalProfit: number
  totalAuctions: number

  // Additional valuable metrics
  activeAuctions: number
  totalBids: number
  conversionRate: number
  avgAuctionValue: number
  topService: { name: string; revenue: number }
  retentionRate: number

  // Chart data
  revenueByPeriod: Array<{ date: string; amount: number }>
  serviceBreakdown: Array<{ service: string; revenue: number; percentage: number }>
  auctionPerformance: Array<{ status: string; count: number }>

  // Recent activity
  recentAuctions: Array<{
    id: string
    title: string
    revenue: number
    date: string
    status: string
  }>
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { user, profile } = useUser()
  const [analytics, setAnalytics] = useState<ModelAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month')

  // Check authentication and role
  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }

    if (profile?.role !== USER_ROLES.MODEL) {
      router.push('/dashboard')
      return
    }

    fetchAnalytics()
  }, [user, profile, selectedPeriod])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError('')

      // Fetch MODEL-specific analytics
      const response = await fetch(`/api/analytics/model?period=${selectedPeriod}`)
      const data = await response.json()

      if (data.success) {
        setAnalytics(data.analytics)
      } else {
        throw new Error(data.error || 'Failed to fetch analytics')
      }
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError('Failed to load analytics data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (!analytics) return

    const csvContent = [
      ['Metric', 'Value'],
      ['Total Funds Collected', analytics.totalFundsCollected],
      ['Beauty Services Revenue', analytics.beautyServicesRevenue],
      ['Total Profit', analytics.totalProfit],
      ['Total Auctions', analytics.totalAuctions],
      ['Active Auctions', analytics.activeAuctions],
      ['Total Bids', analytics.totalBids],
      ['Conversion Rate', `${analytics.conversionRate}%`],
      ['Average Auction Value', analytics.avgAuctionValue],
      ['Top Service', `${analytics.topService.name} (AED ${analytics.topService.revenue})`],
      ['Retention Rate', `${analytics.retentionRate}%`],
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
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
    return `AED ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  if (loading && !analytics) {
    return (
      <div className="cosmic-bg-model min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading analytics...</p>
        </div>
      </div>
    )
  }

  // For now, use mock data to demonstrate the layout
  const mockAnalytics: ModelAnalytics = analytics || {
    totalFundsCollected: 125680.50,
    beautyServicesRevenue: 98450.00,
    totalProfit: 45230.75,
    totalAuctions: 156,
    activeAuctions: 12,
    totalBids: 1842,
    conversionRate: 78.5,
    avgAuctionValue: 805.65,
    topService: { name: "Premium Makeup", revenue: 35600.00 },
    retentionRate: 65.3,
    revenueByPeriod: [
      { date: '2024-01-01', amount: 15600 },
      { date: '2024-01-02', amount: 18900 },
      { date: '2024-01-03', amount: 22300 },
      { date: '2024-01-04', amount: 19800 },
      { date: '2024-01-05', amount: 24500 },
    ],
    serviceBreakdown: [
      { service: 'Premium Makeup', revenue: 35600, percentage: 36.2 },
      { service: 'Bridal Services', revenue: 28900, percentage: 29.4 },
      { service: 'Hair Styling', revenue: 22150, percentage: 22.5 },
      { service: 'Spa Treatments', revenue: 11800, percentage: 12.0 },
    ],
    auctionPerformance: [
      { status: 'Completed', count: 122 },
      { status: 'Active', count: 12 },
      { status: 'Cancelled', count: 22 },
    ],
    recentAuctions: [
      { id: '1', title: 'Premium Bridal Package', revenue: 2850.00, date: '2024-01-05', status: 'completed' },
      { id: '2', title: 'Luxury Spa Day', revenue: 1200.00, date: '2024-01-04', status: 'completed' },
      { id: '3', title: 'Celebrity Makeup Session', revenue: 950.00, date: '2024-01-04', status: 'active' },
      { id: '4', title: 'Hair & Makeup Combo', revenue: 750.00, date: '2024-01-03', status: 'completed' },
      { id: '5', title: 'Weekend Spa Retreat', revenue: 3200.00, date: '2024-01-02', status: 'completed' },
    ]
  }

  return (
    <div className="cosmic-bg-model min-h-screen">
      <div className="px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Back Button and Header */}
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="mb-4 flex items-center text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="cosmic-card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">Analytics Dashboard</h1>
                  <p className="mt-2 text-gray-300">Track your auction performance and revenue insights</p>
                </div>
                <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
                  {/* Time Period Selector */}
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value as TimePeriod)}
                    className="px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:border-purple-500"
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
                    disabled={!mockAnalytics}
                    className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 cosmic-card bg-red-500/20 border-red-500/50">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-300">Error loading analytics</h3>
                  <p className="mt-1 text-sm text-red-200">{error}</p>
                  <button
                    onClick={fetchAnalytics}
                    className="mt-2 text-sm font-medium text-red-300 hover:text-red-200"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Stat Cards - Core Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              label="Total Funds Collected"
              value={loading ? '...' : formatCurrency(mockAnalytics.totalFundsCollected)}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              }
              color="green"
            />
            <StatCard
              label="Beauty Services"
              value={loading ? '...' : formatCurrency(mockAnalytics.beautyServicesRevenue)}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              }
              color="blue"
            />
            <StatCard
              label="Total Profit"
              value={loading ? '...' : formatCurrency(mockAnalytics.totalProfit)}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              }
              color="purple"
            />
            <StatCard
              label="Total Auctions"
              value={loading ? '...' : mockAnalytics.totalAuctions.toString()}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              }
              color="gray"
            />
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <MetricCard
              label="Active Auctions"
              value={loading ? '...' : mockAnalytics.activeAuctions.toString()}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              }
            />
            <MetricCard
              label="Total Bids"
              value={loading ? '...' : mockAnalytics.totalBids.toString()}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              }
            />
            <MetricCard
              label="Conversion Rate"
              value={loading ? '...' : formatPercentage(mockAnalytics.conversionRate)}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              }
            />
            <MetricCard
              label="Avg Auction Value"
              value={loading ? '...' : formatCurrency(mockAnalytics.avgAuctionValue)}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              }
            />
            <MetricCard
              label="Top Service"
              value={loading ? '...' : `${mockAnalytics.topService.name}`}
              subValue={loading ? '' : formatCurrency(mockAnalytics.topService.revenue)}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              }
            />
            <MetricCard
              label="Retention Rate"
              value={loading ? '...' : formatPercentage(mockAnalytics.retentionRate)}
              icon={
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              }
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Revenue Trend Chart */}
            <div className="cosmic-card">
              <h2 className="text-lg font-semibold text-white mb-4">Revenue Trend</h2>
              <div className="h-64 flex items-center justify-center text-gray-400">
                <div>
                  <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  <p className="text-sm">Chart visualization coming soon</p>
                </div>
              </div>
            </div>

            {/* Services Breakdown */}
            <div className="cosmic-card">
              <h2 className="text-lg font-semibold text-white mb-4">Services Breakdown</h2>
              <div className="space-y-3">
                {mockAnalytics.serviceBreakdown.map((service, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">{service.service}</span>
                      <span className="text-white font-medium">{formatCurrency(service.revenue)}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full"
                        style={{ width: `${service.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="cosmic-card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white">Recent Auctions</h2>
              <button className="text-purple-400 hover:text-purple-300 text-sm">
                View All
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-400 text-sm">
                    <th className="pb-3 pr-4">Title</th>
                    <th className="pb-3 pr-4">Revenue</th>
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockAnalytics.recentAuctions.map((auction) => (
                    <tr key={auction.id} className="border-t border-white/10">
                      <td className="py-3 pr-4 text-white">{auction.title}</td>
                      <td className="py-3 pr-4 text-white">{formatCurrency(auction.revenue)}</td>
                      <td className="py-3 pr-4 text-gray-300">{new Date(auction.date).toLocaleDateString()}</td>
                      <td className="py-3">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          auction.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : auction.status === 'active'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {auction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Stat Card Component (Main metrics)
 */
function StatCard({
  label,
  value,
  icon,
  color = 'gray',
}: {
  label: string
  value: string
  icon: React.ReactNode
  color?: 'gray' | 'green' | 'blue' | 'purple'
}) {
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
  }

  return (
    <div className="cosmic-card bg-white/95 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="mt-2 text-2xl md:text-[26px] font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icon}
          </svg>
        </div>
      </div>
    </div>
  )
}

/**
 * Metric Card Component (Secondary metrics)
 */
function MetricCard({
  label,
  value,
  subValue,
  icon,
}: {
  label: string
  value: string
  subValue?: string
  icon: React.ReactNode
}) {
  return (
    <div className="cosmic-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="mt-1 text-xl font-semibold text-white">{value}</p>
          {subValue && (
            <p className="text-sm text-gray-300 mt-1">{subValue}</p>
          )}
        </div>
        <div className="p-2 bg-white/10 rounded-lg">
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icon}
          </svg>
        </div>
      </div>
    </div>
  )
}