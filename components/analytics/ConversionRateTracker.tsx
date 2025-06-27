'use client'

import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ProgressBar } from 'recharts'
import type { ConversionRate } from '@/lib/analytics'

interface ConversionRateTrackerProps {
  data: ConversionRate
  loading?: boolean
  showProgress?: boolean
}

export function ConversionRateTracker({ 
  data, 
  loading = false,
  showProgress = true
}: ConversionRateTrackerProps) {
  if (loading) {
    return (
      <div className="w-full h-80 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-500">Loading conversion data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-full h-80 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-500 font-medium">No conversion data available</p>
          <p className="text-gray-400 text-sm">Create payment links to see conversion metrics</p>
        </div>
      </div>
    )
  }

  const getConversionRateColor = (rate: number) => {
    if (rate >= 75) return 'text-green-600'
    if (rate >= 50) return 'text-yellow-600'
    if (rate >= 25) return 'text-orange-600'
    return 'text-red-600'
  }

  const getUsageRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600'
    if (rate >= 60) return 'text-yellow-600'
    if (rate >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getProgressBarColor = (rate: number) => {
    if (rate >= 75) return '#10b981' // green
    if (rate >= 50) return '#f59e0b' // yellow
    if (rate >= 25) return '#f97316' // orange
    return '#ef4444' // red
  }

  // Create funnel data for visualization
  const funnelData = [
    {
      step: 'Payment Links Created',
      value: data.paymentLinksCreated,
      percentage: 100,
      color: '#8b5cf6'
    },
    {
      step: 'Payment Links Used',
      value: data.paymentLinksUsed,
      percentage: data.usageRate,
      color: '#06b6d4'
    },
    {
      step: 'Successful Payments',
      value: data.totalPayments,
      percentage: data.paymentLinksCreated > 0 ? (data.totalPayments / data.paymentLinksCreated) * 100 : 0,
      color: '#10b981'
    }
  ]

  return (
    <div className="w-full space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Usage Rate</p>
              <p className={`text-3xl font-bold ${getUsageRateColor(data.usageRate)}`}>
                {data.usageRate.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.paymentLinksUsed} of {data.paymentLinksCreated} links used
              </p>
            </div>
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
              <p className={`text-3xl font-bold ${getConversionRateColor(data.conversionRate)}`}>
                {data.conversionRate.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.totalPayments} successful payments
              </p>
            </div>
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Links</p>
              <p className="text-3xl font-bold text-gray-900">{data.paymentLinksCreated}</p>
              <p className="text-xs text-gray-500 mt-1">
                Payment links created
              </p>
            </div>
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
        <div className="space-y-4">
          {funnelData.map((step, index) => (
            <div key={step.step} className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{step.step}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-900">{step.value}</span>
                  <span className="text-xs text-gray-500 ml-2">({step.percentage.toFixed(1)}%)</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                <div 
                  className="h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${step.percentage}%`,
                    backgroundColor: step.color
                  }}
                />
                {/* Connecting line to next step */}
                {index < funnelData.length - 1 && (
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1">
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insights and Recommendations */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Insights & Recommendations</h3>
        <div className="space-y-3">
          {data.usageRate < 50 && (
            <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800">Low Usage Rate</p>
                <p className="text-xs text-yellow-700">Many payment links aren't being used. Consider improving your marketing or link distribution strategy.</p>
              </div>
            </div>
          )}
          
          {data.conversionRate < 25 && data.paymentLinksUsed > 0 && (
            <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800">Low Conversion Rate</p>
                <p className="text-xs text-red-700">Visitors aren't completing payments. Check your pricing, payment process, or value proposition.</p>
              </div>
            </div>
          )}
          
          {data.conversionRate >= 50 && data.usageRate >= 60 && (
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
              <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-800">Great Performance</p>
                <p className="text-xs text-green-700">Your payment links are performing well! Consider creating more links to scale your revenue.</p>
              </div>
            </div>
          )}
          
          {data.paymentLinksCreated === 0 && (
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-800">Get Started</p>
                <p className="text-xs text-blue-700">Create your first payment link to start tracking conversion metrics.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConversionRateTracker