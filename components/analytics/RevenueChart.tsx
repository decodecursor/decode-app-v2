'use client'

import React, { useState, useRef } from 'react'
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
  // Mouse tracking state for custom tooltip positioning
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [activeData, setActiveData] = useState<any>(null)
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const chartContainerRef = useRef<HTMLDivElement>(null)
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

  // Native DOM mouse event handlers with smart data point detection
  const handleContainerMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!chartContainerRef.current) return

    const rect = chartContainerRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    // Calculate chart area (accounting for margins)
    const margins = { top: 5, right: 30, left: 20, bottom: 5 }
    const chartWidth = rect.width - margins.left - margins.right
    const chartHeight = rect.height - margins.top - margins.bottom
    
    // Check if mouse is within chart area
    if (x < margins.left || x > rect.width - margins.right || 
        y < margins.top || y > rect.height - margins.bottom) {
      setIsTooltipVisible(false)
      setMousePosition(null)
      setActiveData(null)
      return
    }
    
    // Calculate which data point we're hovering over
    const relativeX = x - margins.left
    const dataPointIndex = Math.round((relativeX / chartWidth) * (data.length - 1))
    
    // Ensure index is within bounds
    if (dataPointIndex < 0 || dataPointIndex >= data.length) {
      setIsTooltipVisible(false)
      setMousePosition(null)
      setActiveData(null)
      return
    }
    
    const hoveredData = data[dataPointIndex]
    
    // Only show tooltip if there's actual revenue data (not zero or null)
    if (!hoveredData || hoveredData.revenue === 0 || hoveredData.revenue == null) {
      setIsTooltipVisible(false)
      setMousePosition(null)
      setActiveData(null)
      return
    }
    
    // Set tooltip state
    setMousePosition({ x, y })
    setActiveData({ payload: hoveredData })
    setIsTooltipVisible(true)
  }

  const handleContainerMouseLeave = () => {
    setIsTooltipVisible(false)
    setMousePosition(null)
    setActiveData(null)
  }

  // Custom positioned tooltip component
  const CustomPositionedTooltip = () => {
    if (!isTooltipVisible || !mousePosition || !activeData) return null

    // Smart positioning logic to keep tooltip in view
    const tooltipWidth = 200
    const tooltipHeight = 100
    const padding = 15
    const containerRect = chartContainerRef.current?.getBoundingClientRect()
    
    if (!containerRect) return null

    let x = mousePosition.x + padding
    let y = mousePosition.y - tooltipHeight - padding

    // Adjust if tooltip goes off right edge
    if (x + tooltipWidth > containerRect.width) {
      x = mousePosition.x - tooltipWidth - padding
    }

    // Adjust if tooltip goes off top edge
    if (y < 0) {
      y = mousePosition.y + padding
    }

    // Adjust if tooltip goes off bottom edge
    if (y + tooltipHeight > containerRect.height) {
      y = mousePosition.y - tooltipHeight - padding
    }

    return (
      <div 
        className="absolute bg-white p-4 border border-gray-200 rounded-lg shadow-lg pointer-events-none z-50"
        style={{ 
          left: `${x}px`,
          top: `${y}px`,
          width: `${tooltipWidth}px`
        }}
      >
        <p className="font-medium text-gray-900 mb-2">
          {format(parseISO(activeData.payload.date), 'MMM dd, yyyy')}
        </p>
        <p className="text-sm text-purple-600">
          Revenue: {formatTooltipValue(activeData.payload.revenue, 'revenue')[0]}
        </p>
        {showTransactions && activeData.payload.transactions && (
          <p className="text-sm text-cyan-600">
            Transactions: {formatTooltipValue(activeData.payload.transactions, 'transactions')[0]}
          </p>
        )}
        {showSuccessRate && activeData.payload.successRate && (
          <p className="text-sm text-green-600">
            Success Rate: {formatTooltipValue(activeData.payload.successRate, 'successRate')[0]}
          </p>
        )}
      </div>
    )
  }

  if (chartType === 'bar') {
    return (
      <div 
        className="w-full h-80 relative" 
        ref={chartContainerRef}
        onMouseMove={handleContainerMouseMove}
        onMouseLeave={handleContainerMouseLeave}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
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
        <CustomPositionedTooltip />
      </div>
    )
  }

  return (
    <div 
      className="w-full h-80 relative" 
      ref={chartContainerRef}
      onMouseMove={handleContainerMouseMove}
      onMouseLeave={handleContainerMouseLeave}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={data} 
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
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
      <CustomPositionedTooltip />
    </div>
  )
}

export default RevenueChart