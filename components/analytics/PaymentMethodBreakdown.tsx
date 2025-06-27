'use client'

import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { PaymentMethodBreakdown } from '@/lib/analytics'

interface PaymentMethodBreakdownProps {
  data: PaymentMethodBreakdown[]
  loading?: boolean
  chartType?: 'pie' | 'bar'
  showRevenue?: boolean
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#84cc16']

export function PaymentMethodBreakdown({ 
  data, 
  loading = false, 
  chartType = 'pie',
  showRevenue = false 
}: PaymentMethodBreakdownProps) {
  if (loading) {
    return (
      <div className="w-full h-80 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-500">Loading payment methods...</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-80 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="text-gray-500 font-medium">No payment method data available</p>
          <p className="text-gray-400 text-sm">Payment method breakdown will appear here</p>
        </div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{data.method}</p>
          <p className="text-sm text-gray-600">
            Transactions: {data.count} ({data.percentage.toFixed(1)}%)
          </p>
          {showRevenue && (
            <p className="text-sm text-gray-600">
              Revenue: ${data.revenue.toFixed(2)}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null // Don't show labels for slices smaller than 5%
    
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="500"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  if (chartType === 'bar') {
    return (
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="method" 
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            {showRevenue && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                tickFormatter={(value) => `$${value}`}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar 
              yAxisId="left"
              dataKey="count" 
              fill="#8b5cf6" 
              name="Transactions"
              radius={[2, 2, 0, 0]}
            />
            {showRevenue && (
              <Bar 
                yAxisId="right"
                dataKey="revenue" 
                fill="#06b6d4" 
                name="Revenue"
                radius={[2, 2, 0, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={CustomLabel}
              outerRadius={100}
              fill="#8884d8"
              dataKey={showRevenue ? "revenue" : "count"}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Statistics Table */}
      <div className="mt-6">
        <div className="bg-gray-50 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-900">Payment Method Details</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {data.map((method, index) => (
              <div key={method.method} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-medium text-gray-900">{method.method}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {method.count} transactions ({method.percentage.toFixed(1)}%)
                  </div>
                  {showRevenue && (
                    <div className="text-xs text-gray-500">
                      ${method.revenue.toFixed(2)} revenue
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentMethodBreakdown