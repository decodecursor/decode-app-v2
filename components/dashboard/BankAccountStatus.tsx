'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { VerificationBadge } from '@/components/stripe/VerificationBadge'

interface BankAccountStatusProps {
  userId: string
}

export function BankAccountStatus({ userId }: BankAccountStatusProps) {
  const [loading, setLoading] = useState(true)
  const [accountStatus, setAccountStatus] = useState<'not_connected' | 'pending' | 'active' | 'restricted' | null>(null)
  const [hasConnectedAccount, setHasConnectedAccount] = useState(false)
  const [nextPayoutDate, setNextPayoutDate] = useState<string | null>(null)
  const [balance, setBalance] = useState<{ available: number; currency: string } | null>(null)

  useEffect(() => {
    loadAccountStatus()
  }, [userId])

  const loadAccountStatus = async () => {
    try {
      // Load user's Stripe Connect status
      const { data: userData } = await supabase
        .from('users')
        .select('stripe_connect_account_id, stripe_connect_status, stripe_onboarding_completed')
        .eq('id', userId)
        .single()

      if (userData?.stripe_connect_account_id) {
        setHasConnectedAccount(true)
        setAccountStatus(userData.stripe_connect_status || 'pending')

        // Load balance if account is active
        if (userData.stripe_connect_status === 'active') {
          try {
            const balanceResponse = await fetch(`/api/stripe/account-balance?userId=${userId}`)
            if (balanceResponse.ok) {
              const balanceData = await balanceResponse.json()
              setBalance({
                available: balanceData.available || 0,
                currency: balanceData.currency || 'AED'
              })
            }
          } catch (error) {
            console.error('Error loading balance:', error)
          }

          // Calculate next Monday
          const today = new Date()
          const daysUntilMonday = (8 - today.getDay()) % 7 || 7
          const nextMonday = new Date(today)
          nextMonday.setDate(today.getDate() + daysUntilMonday)
          setNextPayoutDate(nextMonday.toLocaleDateString('en-AE', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          }))
        }
      }
    } catch (error) {
      console.error('Error loading account status:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="cosmic-card">
        <div className="animate-pulse">
          <div className="h-4 w-32 bg-gray-700 rounded mb-4" />
          <div className="h-8 w-24 bg-gray-700 rounded mb-2" />
          <div className="h-4 w-40 bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  if (!hasConnectedAccount) {
    return (
      <div className="cosmic-card">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Bank Account</h3>
            <p className="text-gray-400 text-sm mb-4">Connect your bank account to receive weekly payouts</p>
          </div>
          <div className="w-12 h-12 bg-gray-800/50 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
        </div>
        <Link
          href="/bank-account"
          className="block w-full text-center cosmic-button-primary mt-4"
        >
          Connect Bank Account
        </Link>
      </div>
    )
  }

  return (
    <div className="cosmic-card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Bank Account</h3>
          <div className="flex items-center gap-2">
            <VerificationBadge status={accountStatus || 'pending'} size="sm" />
          </div>
        </div>
        <Link
          href="/bank-account"
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {accountStatus === 'active' && balance && (
        <div className="space-y-3">
          <div>
            <p className="text-gray-400 text-sm">Available Balance</p>
            <p className="text-2xl font-bold text-white">
              {balance.currency} {balance.available.toFixed(2)}
            </p>
          </div>
          {nextPayoutDate && (
            <div>
              <p className="text-gray-400 text-sm">Next Payout</p>
              <p className="text-white">{nextPayoutDate}</p>
            </div>
          )}
        </div>
      )}

      {accountStatus === 'pending' && (
        <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-3 mt-3">
          <p className="text-yellow-100 text-sm">Verification in progress</p>
        </div>
      )}

      {accountStatus === 'restricted' && (
        <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-3 mt-3">
          <p className="text-red-100 text-sm">Action required</p>
          <Link href="/bank-account" className="text-red-400 hover:text-red-300 text-sm underline">
            Complete setup
          </Link>
        </div>
      )}
    </div>
  )
}