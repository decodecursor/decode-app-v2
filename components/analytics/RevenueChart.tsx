'use client'

import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { format, parseISO } from 'date-fns'
import type { RevenueByDay } from '@/lib/analytics'

interface RevenueChartProps {
  data: RevenueByDay[]
  loading?: boolean
  chartType?: 'line' | 'bar'
  showTransactions?: boolean
  showSuccessRate?: boolean
}

export function RevenueChart({ 
  data, 
  loading = false, 
  chartType = 'line',
  showTransactions = true,
  showSuccessRate = false
}: RevenueChartProps) {
  if (loading) {
    return (
      <div className="w-full h-80 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-500">Loading revenue data...</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-80 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-500 font-medium">No revenue data available</p>
          <p className="text-gray-400 text-sm">Revenue will appear here once you start receiving payments</p>
        </div>
      </div>
    )
  }

  const formatTooltipValue = (value: number, name: string) => {
    switch (name) {
      case 'revenue':
        return [`$${value.toFixed(2)}`, 'Revenue']
      case 'transactions':
        return [value.toString(), 'Transactions']
      case 'successRate':
        return [`${value.toFixed(1)}%`, 'Success Rate']
      default:
        return [value, name]
    }
  }

  const formatXAxisLabel = (tickItem: string) => {
    try {
      return format(parseISO(tickItem), 'MMM dd')
    } catch {
      return tickItem
    }
  }

  const CustomTooltip = ({ active, payload, label, coordinate }: any) => {
    if (active && payload && payload.length && coordinate) {
      // Calculate tooltip position with offset to avoid cursor overlap
      const offsetX = 15
      const offsetY = -10
      
      return (
        <div 
          className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg pointer-events-none"
          style={{
            position: 'absolute',
            transform: `translate(${coordinate.x + offsetX}px, ${coordinate.y + offsetY}px)`,
            zIndex: 1000
          }}
        >
          <p className="font-medium text-gray-900 mb-2">
            {format(parseISO(label), 'MMM dd, yyyy')}
          </p>
          {payload.map((pld: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: pld.color }}>
              {`${pld.name}: ${formatTooltipValue(pld.value, pld.dataKey)[0]}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (chartType === 'bar') {
    return (
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxisLabel}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
              tickFormatter={(value) => `$${value}`}
            />
            {showTransactions && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
            )}
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ strokeDasharray: '3 3' }}
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ pointerEvents: 'none' }}
            />
            <Legend />
            <Bar 
              yAxisId="left"
              dataKey="revenue" 
              fill="#8b5cf6" 
              name="Revenue"
              radius={[2, 2, 0, 0]}
            />
            {showTransactions && (
              <Bar 
                yAxisId="right"
                dataKey="transactions" 
                fill="#06b6d4" 
                name="Transactions"
                radius={[2, 2, 0, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatXAxisLabel}
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <YAxis 
            yAxisId="left"
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
            tickFormatter={(value) => `$${value}`}
          />
          {(showTransactions || showSuccessRate) && (
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
              tickFormatter={(value) => showSuccessRate ? `${value}%` : value.toString()}
            />
          )}
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ strokeDasharray: '3 3' }}
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ pointerEvents: 'none' }}
          />
          <Legend />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="revenue" 
            stroke="#8b5cf6" 
            strokeWidth={3}
            dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2 }}
            name="Revenue"
          />
          {showTransactions && (
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="transactions" 
              stroke="#06b6d4" 
              strokeWidth={2}
              dot={{ fill: '#06b6d4', strokeWidth: 2, r: 3 }}
              name="Transactions"
            />
          )}
          {showSuccessRate && (
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="successRate" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
              name="Success Rate"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RevenueChart