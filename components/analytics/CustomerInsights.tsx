'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format, parseISO } from 'date-fns'
import type { CustomerInsights, TopCustomer } from '@/lib/analytics'

interface CustomerInsightsProps {
  data: CustomerInsights
  loading?: boolean
  showTopCustomers?: boolean
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

export function CustomerInsights({ 
  data, 
  loading = false,
  showTopCustomers = true
}: CustomerInsightsProps) {
  if (loading) {
    return (
      <div className="w-full h-80 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-500">Loading customer insights...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-full h-80 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-500 font-medium">No customer data available</p>
          <p className="text-gray-400 text-sm">Customer insights will appear once you have transactions</p>
        </div>
      </div>
    )
  }

  const returningCustomerRate = data.totalUniqueCustomers > 0 
    ? (data.returningCustomers / data.totalUniqueCustomers) * 100 
    : 0

  // Customer segmentation data for pie chart
  const customerSegmentData = [
    {
      name: 'New Customers',
      value: data.totalUniqueCustomers - data.returningCustomers,
      color: COLORS[0]
    },
    {
      name: 'Returning Customers',
      value: data.returningCustomers,
      color: COLORS[1]
    }
  ]

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">{data.value} customers</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full space-y-6">
      {/* Customer Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-3xl font-bold text-gray-900">{data.totalUniqueCustomers}</p>
              <p className="text-xs text-gray-500 mt-1">Unique customers</p>
            </div>
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Returning Rate</p>
              <p className="text-3xl font-bold text-purple-600">{returningCustomerRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">{data.returningCustomers} returning customers</p>
            </div>
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Customer Value</p>
              <p className="text-3xl font-bold text-green-600">${data.averageCustomerValue.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Per customer</p>
            </div>
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Segmentation */}
      {data.totalUniqueCustomers > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Segmentation</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={customerSegmentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {customerSegmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center">
              <div className="space-y-4">
                {customerSegmentData.map((segment, index) => (
                  <div key={segment.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      <span className="text-sm font-medium text-gray-700">{segment.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">{segment.value}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({data.totalUniqueCustomers > 0 ? ((segment.value / data.totalUniqueCustomers) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Spending Customers */}
      {showTopCustomers && data.topSpendingCustomers && data.topSpendingCustomers.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Spending Customers</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Spent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.topSpendingCustomers.slice(0, 10).map((customer, index) => (
                  <tr key={customer.email} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-purple-600">
                              {customer.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {customer.email === 'Anonymous' ? 'Anonymous Customer' : customer.email}
                          </div>
                          <div className="text-sm text-gray-500">
                            Rank #{index + 1}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">${customer.totalSpent.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{customer.transactionCount}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(parseISO(customer.lastTransaction), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        customer.transactionCount > 1 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {customer.transactionCount > 1 ? 'Returning' : 'New'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Insights */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Insights</h3>
        <div className="space-y-3">
          {returningCustomerRate > 30 && (
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
              <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-800">High Customer Retention</p>
                <p className="text-xs text-green-700">
                  {returningCustomerRate.toFixed(1)}% of customers have made multiple purchases. Great job building loyalty!
                </p>
              </div>
            </div>
          )}

          {returningCustomerRate < 10 && data.totalUniqueCustomers > 10 && (
            <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800">Low Retention Rate</p>
                <p className="text-xs text-yellow-700">
                  Consider implementing customer retention strategies like follow-up emails or loyalty programs.
                </p>
              </div>
            </div>
          )}

          {data.averageCustomerValue > 100 && (
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-800">High Customer Value</p>
                <p className="text-xs text-blue-700">
                  Your customers spend ${data.averageCustomerValue.toFixed(2)} on average. Consider premium service offerings.
                </p>
              </div>
            </div>
          )}

          {data.totalUniqueCustomers === 0 && (
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <svg className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-800">No Customer Data Yet</p>
                <p className="text-xs text-gray-700">
                  Complete your first transaction to start seeing customer insights.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CustomerInsights