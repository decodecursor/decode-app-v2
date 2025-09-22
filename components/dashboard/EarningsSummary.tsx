'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface EarningsSummaryProps {
  userId: string
  userRole?: string
}

interface EarningsData {
  todayEarnings: number
  weekEarnings: number
  monthEarnings: number
  totalEarnings: number
}

export function EarningsSummary({ userId, userRole }: EarningsSummaryProps) {
  const [loading, setLoading] = useState(true)
  const [earnings, setEarnings] = useState<EarningsData>({
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    totalEarnings: 0
  })

  useEffect(() => {
    loadEarnings()
  }, [userId, userRole])

  const loadEarnings = async () => {
    try {
      // For ADMIN users, load company-wide earnings
      if (userRole === 'Admin') {
        const response = await fetch('/api/analytics/company-wide', {
          method: 'GET',
          credentials: 'include'
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            const paymentLinks = data.paymentLinks || []

            // Calculate earnings from service amounts
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const weekStart = new Date()
            const day = weekStart.getDay()
            const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
            weekStart.setDate(diff)
            weekStart.setHours(0, 0, 0, 0)

            const monthStart = new Date()
            monthStart.setDate(1)
            monthStart.setHours(0, 0, 0, 0)

            const todayEarnings = paymentLinks
              .filter((link: any) => link.paid_at && new Date(link.paid_at) >= today)
              .reduce((sum: number, link: any) => sum + (link.service_amount_aed || 0), 0)

            const weekEarnings = paymentLinks
              .filter((link: any) => link.paid_at && new Date(link.paid_at) >= weekStart)
              .reduce((sum: number, link: any) => sum + (link.service_amount_aed || 0), 0)

            const monthEarnings = paymentLinks
              .filter((link: any) => link.paid_at && new Date(link.paid_at) >= monthStart)
              .reduce((sum: number, link: any) => sum + (link.service_amount_aed || 0), 0)

            const totalEarnings = paymentLinks
              .reduce((sum: number, link: any) => sum + (link.service_amount_aed || 0), 0)

            setEarnings({
              todayEarnings,
              weekEarnings,
              monthEarnings,
              totalEarnings
            })
          }
        }
        setLoading(false)
        return
      }
      // Get today's start
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Get this week's start (Monday)
      const weekStart = new Date()
      const day = weekStart.getDay()
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
      weekStart.setDate(diff)
      weekStart.setHours(0, 0, 0, 0)

      // Get this month's start
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      // Load today's earnings from paid payment links
      const { data: todayData } = await supabase
        .from('payment_links')
        .select('amount_aed')
        .eq('creator_id', userId)
        .eq('payment_status', 'paid')
        .not('paid_at', 'is', null)
        .gte('paid_at', today.toISOString())

      // Load this week's earnings
      const { data: weekData } = await supabase
        .from('payment_links')
        .select('amount_aed')
        .eq('creator_id', userId)
        .eq('payment_status', 'paid')
        .not('paid_at', 'is', null)
        .gte('paid_at', weekStart.toISOString())

      // Load this month's earnings
      const { data: monthData } = await supabase
        .from('payment_links')
        .select('amount_aed')
        .eq('creator_id', userId)
        .eq('payment_status', 'paid')
        .not('paid_at', 'is', null)
        .gte('paid_at', monthStart.toISOString())

      // Load total earnings
      const { data: totalData } = await supabase
        .from('payment_links')
        .select('amount_aed')
        .eq('creator_id', userId)
        .eq('payment_status', 'paid')

      setEarnings({
        todayEarnings: todayData?.reduce((sum, t) => sum + t.amount_aed, 0) || 0,
        weekEarnings: weekData?.reduce((sum, t) => sum + t.amount_aed, 0) || 0,
        monthEarnings: monthData?.reduce((sum, t) => sum + t.amount_aed, 0) || 0,
        totalEarnings: totalData?.reduce((sum, t) => sum + t.amount_aed, 0) || 0
      })
    } catch (error) {
      console.error('Error loading earnings:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="cosmic-card">
        <h3 className="text-lg font-semibold text-white mb-6">Earnings</h3>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 w-20 bg-gray-700 rounded mb-2" />
              <div className="h-6 w-24 bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-card">
      <h3 className="text-lg font-semibold text-white mb-6">
        {userRole === 'Admin' ? 'Company Earnings' : 'My Earnings'}
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-lg p-4 backdrop-blur-sm">
          <p className="text-gray-400 text-sm mb-1">Today</p>
          <p className="text-xl font-semibold text-white">
            AED {formatAmount(earnings.todayEarnings)}
          </p>
        </div>
        
        <div className="bg-white/5 rounded-lg p-4 backdrop-blur-sm">
          <p className="text-gray-400 text-sm mb-1">This Week</p>
          <p className="text-xl font-semibold text-white">
            AED {formatAmount(earnings.weekEarnings)}
          </p>
        </div>
        
        <div className="bg-white/5 rounded-lg p-4 backdrop-blur-sm">
          <p className="text-gray-400 text-sm mb-1">This Month</p>
          <p className="text-xl font-semibold text-white">
            AED {formatAmount(earnings.monthEarnings)}
          </p>
        </div>
        
        <div className="bg-purple-600/20 rounded-lg p-4 backdrop-blur-sm border border-purple-500/30">
          <p className="text-purple-300 text-sm mb-1">Total</p>
          <p className="text-xl font-semibold text-purple-100">
            AED {formatAmount(earnings.totalEarnings)}
          </p>
        </div>
      </div>

    </div>
  )
}