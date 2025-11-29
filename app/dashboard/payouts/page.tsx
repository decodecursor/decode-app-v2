'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getUserWithProxy } from '@/utils/auth-helper'
import { PayoutHistory } from '@/components/stripe/PayoutHistory'
import { PayoutMethodsCard } from '@/components/payouts/PayoutMethodsCard'
import { PendingPayoutsCard } from '@/components/payouts/PendingPayoutsCard'
import { VideoModal } from '@/components/auctions/VideoModal'
import HeartAnimation from '@/components/effects/HeartAnimation'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'

interface PendingPayoutItem {
  auction_id: string
  auction_title: string
  ended_at: string
  model_amount: number
  payout_status: string
  // Profit breakdown
  winning_amount: number
  start_price: number
  profit_amount: number
  platform_fee_amount: number
  // Video status
  has_video: boolean
  video_watched: boolean
  payout_unlocked: boolean
}

interface PayoutSummary {
  availableBalance: number
  pendingBalance: number
  pendingPayouts?: PendingPayoutItem[]
  totalEarnings: number
  totalPaidOut: number
  lastPayoutAmount: number
  lastPayoutDate: string | null
  bankConnected: boolean
}

interface PayoutMethod {
  type: 'bank_account' | 'paypal'
  displayName: string
  isConnected: boolean
}

export default function PayoutsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showMinimumBalanceModal, setShowMinimumBalanceModal] = useState(false)
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestAmount, setRequestAmount] = useState('')
  const [payoutInProcess, setPayoutInProcess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [requestError, setRequestError] = useState('')
  const [modalError, setModalError] = useState('')
  const [selectedPayoutMethod, setSelectedPayoutMethod] = useState<'bank_account' | 'paypal' | null>(null)
  const [availablePayoutMethods, setAvailablePayoutMethods] = useState<PayoutMethod[]>([])
  const [showSelectMethodModal, setShowSelectMethodModal] = useState(false)
  const [showNoPaymentMethodModal, setShowNoPaymentMethodModal] = useState(false)
  const [heartAnimatingId, setHeartAnimatingId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [bankAccountData, setBankAccountData] = useState<any>(null)
  const [paypalAccountData, setPaypalAccountData] = useState<any>(null)
  const [selectedAuctionIds, setSelectedAuctionIds] = useState<Set<string>>(new Set())
  const [videoModalAuction, setVideoModalAuction] = useState<{ id: string; title: string } | null>(null)
  const router = useRouter()

  // Handler for watching video from PendingPayoutsCard
  const handleWatchVideo = (auctionId: string, auctionTitle: string) => {
    setVideoModalAuction({ id: auctionId, title: auctionTitle })
  }

  // Handler for when payout is unlocked after watching video
  const handlePayoutUnlocked = async () => {
    if (user && videoModalAuction) {
      // Add the newly unlocked auction to selection
      const newSelected = new Set(selectedAuctionIds)
      newSelected.add(videoModalAuction.id)
      setSelectedAuctionIds(newSelected)

      await fetchPayoutSummary(user.id)
    }
    setVideoModalAuction(null)
  }

  // Fetch user profile with role information
  const fetchUserProfile = async (userId: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return
      }

      setUserRole(data?.role || '')
    } catch (error) {
      console.error('Exception fetching user profile:', error)
    }
  }

  // Helper function to get card titles based on user role
  const getCardTitle = (baseTitle: string) => {
    return userRole === 'Admin' ? baseTitle.replace('My', 'Company') : baseTitle
  }

  useEffect(() => {
    const getUser = async () => {
      try {
        const { user } = await getUserWithProxy()
        if (!user) {
          router.push('/auth')
          return
        }
        setUser(user)

        // Load all data in parallel for better performance
        await Promise.all([
          fetchUserProfile(user.id),
          fetchPayoutSummary(user.id),
          loadPayoutMethods()
        ])
      } catch (error) {
        console.error('Authentication failed:', error)
        router.push('/auth')
      }
    }
    getUser()
  }, [])

  // Auto-select all unlocked payouts on page load (MODEL users only)
  useEffect(() => {
    if (
      userRole?.toLowerCase() === 'model' &&
      payoutSummary?.pendingPayouts &&
      payoutSummary.pendingPayouts.length > 0 &&
      selectedAuctionIds.size === 0  // Only auto-select if nothing is selected
    ) {
      const unlockedIds = payoutSummary.pendingPayouts
        .filter(p => p.payout_unlocked)
        .map(p => p.auction_id)

      if (unlockedIds.length > 0) {
        setSelectedAuctionIds(new Set(unlockedIds))
      }
    }
  }, [payoutSummary, userRole])

  const fetchPayoutSummary = async (userId: string) => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/payouts/proxy-summary', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`API Error (${response.status}): ${errorData.error || 'Failed to fetch payout summary'}`)
      }

      const data = await response.json()

      if (data.success && data.payoutSummary) {
        setPayoutSummary(data.payoutSummary)
      } else {
        throw new Error('Invalid response from payout summary API')
      }

    } catch (error: any) {
      console.error('Error fetching payout summary:', error)
      setError(`Error Loading Payouts: ${error?.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const loadPayoutMethods = async () => {
    try {
      // Use new consolidated API for better performance
      const response = await fetch('/api/user/payment-methods', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`API Error (${response.status}): Failed to fetch payment methods`)
      }

      const result = await response.json()

      if (result.success && result.data) {
        const { availableMethods, preferredMethod, bankAccount, paypalAccount } = result.data

        setAvailablePayoutMethods(availableMethods)
        setBankAccountData(bankAccount)
        setPaypalAccountData(paypalAccount)

        // Handle method selection logic
        const isCurrentSelectionAvailable = availableMethods.some(
          (method: PayoutMethod) => method.type === preferredMethod
        )

        if (isCurrentSelectionAvailable) {
          // Keep current selection if it's still available
          setSelectedPayoutMethod(preferredMethod)
        } else if (availableMethods.length > 0) {
          // Auto-select first available method if current selection is no longer available
          const newSelection = availableMethods[0].type
          setSelectedPayoutMethod(newSelection)
          await savePayoutMethodSelection(newSelection)
        } else {
          // Clear selection if no methods available
          setSelectedPayoutMethod(null)
          if (preferredMethod) {
            // Clear from profile if a method was previously selected
            await savePayoutMethodSelection(null)
          }
        }
      }

    } catch (error) {
      console.error('Error loading payout methods:', error)
    }
  }

  const savePayoutMethodSelection = async (method: 'bank_account' | 'paypal' | null) => {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          preferred_payout_method: method
        })
      })

      if (response.ok) {
        setSelectedPayoutMethod(method)
        console.log('✅ Payout method selection saved:', method)
      }
    } catch (error) {
      console.error('Error saving payout method selection:', error)
    }
  }

  const handleSelectMethod = (method: 'bank_account' | 'paypal') => {
    savePayoutMethodSelection(method)
    setShowSelectMethodModal(false)
  }

  const getSelectedMethodDisplayName = () => {
    if (!selectedPayoutMethod) return 'Select Method'
    return selectedPayoutMethod === 'bank_account' ? 'Bank Account' : 'PayPal'
  }

  const handleRequestPayoutClick = () => {
    if (!payoutSummary) return

    // For MODEL users, check if any auctions are selected
    if (userRole?.toLowerCase() === 'model') {
      if (selectedAuctionIds.size === 0) {
        setModalError('Please select at least one auction for payout')
        setShowRequestModal(true)
        return
      }

      const selectedTotal = getSelectedTotal()
      if (selectedTotal < 50) {
        setShowMinimumBalanceModal(true)
        return
      }
    } else {
      // Non-MODEL users (STAFF/ADMIN) use total balance
      if (payoutSummary.availableBalance < 50) {
        setShowMinimumBalanceModal(true)
        return
      }
    }

    // Check if user has any payment method configured
    if (availablePayoutMethods.length === 0 || !selectedPayoutMethod) {
      setShowNoPaymentMethodModal(true)
      return
    }

    // Show request modal
    setModalError('')
    setShowRequestModal(true)
  }

  const handleRequestPayout = async () => {
    if (!user || !payoutSummary) return

    setRequestLoading(true)
    setRequestError('')
    setModalError('')

    try {
      // For MODEL users, use auction-request API with selected auctions
      if (userRole?.toLowerCase() === 'model') {
        if (selectedAuctionIds.size === 0) {
          setModalError('Please select at least one auction for payout')
          setRequestLoading(false)
          return
        }

        const selectedTotal = getSelectedTotal()
        if (selectedTotal < 50) {
          setModalError('Minimum payout amount: AED 50')
          setRequestLoading(false)
          return
        }

        console.log('🚀 [FRONTEND] MODEL auction payout request for', selectedAuctionIds.size, 'auctions, total:', selectedTotal)

        const response = await fetch('/api/payouts/auction-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auction_ids: Array.from(selectedAuctionIds)
          })
        })

        if (response.ok) {
          setShowRequestModal(false)
          setSelectedAuctionIds(new Set())
          await fetchPayoutSummary(user.id)
          setRefreshTrigger(prev => prev + 1)
        } else {
          const errorData = await response.json()
          setRequestError(errorData.error || 'Failed to request payout')
          setTimeout(() => setRequestError(''), 8000)
        }
      } else {
        // Non-MODEL users use the original commission-based payout API
        const amount = parseFloat(requestAmount) || payoutSummary.availableBalance

        if (amount < 50) {
          setModalError('Minimum payout amount: AED 50')
          setRequestLoading(false)
          return
        }

        if (amount > payoutSummary.availableBalance) {
          setModalError(`Requested amount exceeds available balance. You have AED ${payoutSummary.availableBalance.toFixed(2)} available for payout.`)
          setRequestLoading(false)
          return
        }

        console.log('🚀 [FRONTEND] Starting payout request for amount:', amount)

        const response = await fetch('/api/payouts/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount })
        })

        if (response.ok) {
          setShowRequestModal(false)
          setRequestAmount('')
          await fetchPayoutSummary(user.id)
          setRefreshTrigger(prev => prev + 1)
        } else {
          const errorData = await response.json()
          setRequestError(errorData.error || 'Failed to request payout')
          setTimeout(() => setRequestError(''), 8000)
        }
      }
    } catch (error) {
      console.error('Error requesting payout:', error)
      setRequestError('Failed to request payout. Please try again.')
      setTimeout(() => setRequestError(''), 8000)
    } finally {
      setRequestLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'AED'
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Calculate selected auctions total for MODEL users
  const getSelectedTotal = () => {
    if (!payoutSummary?.pendingPayouts) return 0
    return payoutSummary.pendingPayouts
      .filter(p => selectedAuctionIds.has(p.auction_id))
      .reduce((sum, p) => sum + p.model_amount, 0)
  }

  // Toggle auction selection
  const toggleAuctionSelection = (auctionId: string) => {
    // Safety check: prevent locked payouts from being selected
    const payout = payoutSummary?.pendingPayouts?.find(p => p.auction_id === auctionId)
    if (payout && !payout.payout_unlocked) {
      return  // Silently ignore attempts to select locked payouts
    }

    const newSelected = new Set(selectedAuctionIds)
    if (newSelected.has(auctionId)) {
      newSelected.delete(auctionId)
    } else {
      newSelected.add(auctionId)
    }
    setSelectedAuctionIds(newSelected)
  }

  // Toggle all auctions
  const toggleSelectAll = () => {
    if (!payoutSummary?.pendingPayouts) return
    const allIds = payoutSummary.pendingPayouts.map(p => p.auction_id)
    if (selectedAuctionIds.size === allIds.length) {
      setSelectedAuctionIds(new Set())
    } else {
      setSelectedAuctionIds(new Set(allIds))
    }
  }

  // Check if all auctions are selected
  const isAllSelected = () => {
    if (!payoutSummary?.pendingPayouts || payoutSummary.pendingPayouts.length === 0) return false
    return selectedAuctionIds.size === payoutSummary.pendingPayouts.length
  }

  // Always render something, even while loading
  if (loading && !user && !error) {
    return (
      <div className="cosmic-bg min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="cosmic-card">
            <div className="animate-pulse">
              <div className="h-8 w-32 bg-gray-700 rounded mb-4" />
              <div className="space-y-3">
                <div className="h-4 w-48 bg-gray-700 rounded" />
                <div className="h-4 w-64 bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="cosmic-bg min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="cosmic-card text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="cosmic-heading text-white mb-2">Error Loading Payouts</h2>
            <p className="cosmic-body text-white/70 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="cosmic-button-primary"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleNewPayout = (payoutId: string) => {
    setHeartAnimatingId(payoutId)

    // Auto-clear heart animation after 3 seconds
    setTimeout(() => {
      setHeartAnimatingId(null)
    }, 3000)
  }

  return (
    <div className="cosmic-bg min-h-screen">
      {/* Heart Animation - Positioned at specific payout */}
      <HeartAnimation
        isActive={heartAnimatingId !== null}
        targetElementId={heartAnimatingId || undefined}
      />

      <div className="min-h-screen px-4 py-4 md:py-8">
        {/* Back to Dashboard Button */}
        <div className="flex justify-center mb-6 md:mb-0">
          <div className="w-full md:w-[70vw]">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-gray-300 hover:text-white transition-colors payment-back-button"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-center mb-6 md:mb-0">
          <div className="w-full md:w-[70vw]">
            <div className="cosmic-card">
              <div>
                <h1 className="cosmic-heading mb-2 text-2xl md:text-3xl">Payouts</h1>
              </div>
            </div>
          </div>
        </div>


        {/* Request Error Message */}
        {requestError && (
          <div className="flex justify-center mb-6">
            <div className="w-full md:w-[70vw]">
              <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-red-100 font-medium text-sm md:text-base">{requestError}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex justify-center">
          <div className="w-full md:w-[70vw] space-y-6">
            
            {/* Payout Summary Cards */}
            {loading ? (
              <div className="flex flex-col md:flex-row gap-4">
                {[1, 2].map(i => (
                  <div key={i} className="flex-1 cosmic-card">
                    <div className="animate-pulse">
                      <div className="h-4 w-32 bg-gray-700 rounded mb-4" />
                      <div className="h-8 w-24 bg-gray-700 rounded mb-2" />
                      <div className="h-4 w-40 bg-gray-700 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-4">
                {/* My Next Payout Card */}
                <div className="flex-1 cosmic-card">
                  <div className="mb-4">
                    <h3 className="text-base md:text-lg font-semibold text-white">
                      {userRole === 'Admin' ? 'Select Payout Method' : getCardTitle('My Next Payout')}
                    </h3>
                  </div>

                  {/* Mobile: Horizontal, Desktop: Two-Column */}
                  <div className="flex flex-row gap-4 mb-3">
                    {/* Available Balance - Hidden for ADMIN */}
                    {userRole !== 'Admin' && (
                      <div className="flex-1" style={{width: '53%'}}>
                        <p className="text-gray-400 text-xs md:text-sm mb-1">Available Balance</p>
                        <p className="text-xl md:text-2xl font-bold text-white">
                          {formatCurrency(payoutSummary?.availableBalance || 0)}
                        </p>
                      </div>
                    )}

                    {/* Payout to - Styled Subcard */}
                    <div style={{width: '47%'}}>
                      <p className="text-gray-400 text-xs md:text-sm mb-1">Payout to</p>
                      <div
                        onClick={() => setShowSelectMethodModal(true)}
                        className={`bg-white/5 rounded-lg py-3 md:py-2 px-3 border ${
                          selectedPayoutMethod ? 'border-purple-500' : 'border-gray-700'
                        } cursor-pointer hover:border-purple-500 hover:bg-white/8 transition-all group min-h-[48px] md:min-h-0 flex items-center`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <p className="text-white text-sm font-bold">
                            {getSelectedMethodDisplayName()}
                          </p>
                          <div className="w-5 h-5 md:w-6 md:h-6 text-gray-400 group-hover:text-purple-400 transition-colors">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>


                  {/* Action Button - Hidden for ADMIN */}
                  {userRole !== 'Admin' && (
                    <div>
                      <button
                        onClick={handleRequestPayoutClick}
                        disabled={payoutInProcess || (userRole?.toLowerCase() === 'model' && selectedAuctionIds.size === 0)}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                      >
                        {userRole?.toLowerCase() === 'model'
                          ? `Request Payout${selectedAuctionIds.size > 0 ? ` (${formatCurrency(getSelectedTotal())})` : ''}`
                          : 'Request Payout'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Total Payouts Card (All Roles) */}
                <div className="flex-1 cosmic-card">
                  <div className="mb-4">
                    <h3 className="text-base md:text-lg font-semibold text-white">
                      {getCardTitle('My Total Payouts')}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400 text-xs md:text-sm">Paid Amount</p>
                      <p className="text-xl md:text-2xl font-bold text-white">
                        {formatCurrency(payoutSummary?.totalPaidOut || 0)}
                      </p>
                    </div>

                    {payoutSummary?.lastPayoutDate && (
                      <div>
                        <p className="text-gray-400 text-xs md:text-sm">Last Payout</p>
                        <p className="text-white text-sm md:text-base">
                          {formatCurrency(payoutSummary.lastPayoutAmount)} on {formatDate(payoutSummary.lastPayoutDate)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* My Payout Methods Card */}
                {user && <PayoutMethodsCard
                  userId={user.id}
                  userRole={userRole}
                  onMethodDeleted={loadPayoutMethods}
                  bankAccountData={bankAccountData}
                  paypalAccountData={paypalAccountData}
                  selectedPayoutMethod={selectedPayoutMethod}
                />}
              </div>
            )}

            {/* Pending Payouts Card - Full width (MODEL only) */}
            {!loading && userRole?.toLowerCase() === 'model' && (
              <PendingPayoutsCard
                pendingPayouts={payoutSummary?.pendingPayouts || []}
                onWatchVideo={handleWatchVideo}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                selectedAuctionIds={selectedAuctionIds}
                onToggleSelection={toggleAuctionSelection}
              />
            )}

            {/* Payout History - Hidden for ADMIN */}
            {user && userRole !== 'Admin' && <PayoutHistory userId={user.id} onNewPayout={handleNewPayout} refreshTrigger={refreshTrigger} />}
          </div>
        </div>

        {/* Payout Request Modal */}
        {showRequestModal && (
          <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4">
            <div className="bg-gray-900 rounded-t-xl md:rounded-xl border border-gray-700 p-6 w-full max-w-[400px] md:mx-auto">
              <h3 className="text-base md:text-lg font-semibold text-white mb-4">Request Payout</h3>
              
              {/* Modal Error Message */}
              {modalError && (
                <div className="bg-red-600/20 border border-red-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-red-100 text-sm font-medium">{modalError}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {userRole?.toLowerCase() === 'model' ? (
                  /* MODEL: Show selected auctions */
                  <>
                    {/* Amount Display - No container */}
                    <div className="mb-9">
                      <p className="text-3xl font-bold text-white">
                        {formatCurrency(getSelectedTotal())}
                      </p>
                    </div>

                    {/* Selected Auctions Sub-headline */}
                    <h4 className="text-white text-sm font-medium mb-3">
                      Selected Auctions ({selectedAuctionIds.size})
                    </h4>

                    {/* List selected auctions */}
                    <div className="max-h-[200px] overflow-y-auto space-y-2">
                      {payoutSummary?.pendingPayouts?.filter(p => selectedAuctionIds.has(p.auction_id)).map((payout) => (
                        <div key={payout.auction_id} className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                          <p className="text-sm text-white truncate flex-1 mr-2">{payout.auction_title}</p>
                          <p className="text-sm font-semibold text-green-400">{formatCurrency(payout.model_amount)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  /* Non-MODEL: Show amount input */
                  <>
                    <div className="bg-gradient-to-br from-purple-600/10 to-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                      <label className="block text-sm text-purple-300 mb-2 font-medium">
                        Available Balance
                      </label>
                      <p className="text-2xl font-bold text-white bg-gradient-to-r from-purple-300 to-white bg-clip-text text-transparent">
                        {formatCurrency(payoutSummary?.availableBalance || 0)}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="amount" className="block text-sm text-gray-400 mb-2">
                        Request Amount
                      </label>
                      <input
                        id="amount"
                        type="number"
                        value={requestAmount}
                        onChange={(e) => setRequestAmount(e.target.value)}
                        placeholder={`${payoutSummary?.availableBalance || 0}`}
                        min="50"
                        max={payoutSummary?.availableBalance || 0}
                        className="cosmic-input w-full"
                      />
                    </div>
                  </>
                )}

                <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-100" style={{fontSize: '11px'}}>
                    Payout Method: {getSelectedMethodDisplayName()}
                    <br />
                    Payouts are typically processed within 1-2 business days.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 cosmic-button-secondary"
                  disabled={requestLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestPayout}
                  disabled={requestLoading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {requestLoading ? 'Processing...' : 'Request Payout'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Minimum Balance Modal */}
        {showMinimumBalanceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4">
            <div className="bg-gray-900 rounded-t-xl md:rounded-xl border border-gray-700 p-6 w-full max-w-md md:mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-white mb-4">Minimum Payout Required</h3>
                <p className="text-gray-300 mb-6">
                  Minimum payout shall be AED 50.
                </p>
                <div className="mb-6">
                  <p className="text-sm text-gray-400">Current Balance:</p>
                  <p className="text-xl font-bold text-white">
                    {formatCurrency(payoutSummary?.availableBalance || 0)}
                  </p>
                </div>
                <button
                  onClick={() => setShowMinimumBalanceModal(false)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No Payment Method Modal */}
        {showNoPaymentMethodModal && (
          <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4">
            <div className="bg-gray-900 rounded-t-xl md:rounded-xl border border-gray-700 p-6 w-full max-w-md md:mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-white mb-4">Payout Method Required</h3>
                <p className="text-gray-300 text-sm md:text-base mb-6">
                  You must configure a payment method before requesting a payout. Please set up a bank account or PayPal account in the payout methods section on the right side.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowNoPaymentMethodModal(false)}
                    className="flex-1 cosmic-button-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowNoPaymentMethodModal(false)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Select Method Modal */}
        {showSelectMethodModal && (
          <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4">
            <div className="bg-gray-900 rounded-t-xl md:rounded-xl border border-gray-700 p-6 w-full max-w-md md:mx-auto">
              <h3 className="text-base md:text-lg font-semibold text-white mb-4">Select Payout Method</h3>

              <div className="space-y-3 mb-6">
                {availablePayoutMethods.map((method) => (
                  <button
                    key={method.type}
                    onClick={() => handleSelectMethod(method.type)}
                    className={`w-full p-4 rounded-lg border transition-colors text-left ${
                      selectedPayoutMethod === method.type
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{method.displayName}</p>
                        <p className="text-gray-400 text-sm">Connected</p>
                      </div>
                      {selectedPayoutMethod === method.type && (
                        <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}

                {availablePayoutMethods.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-400">
                      You must configure a payment method before requesting a payout. Please set up a bank account or PayPal account in the payout methods section on the right side.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSelectMethodModal(false)}
                  className="flex-1 cosmic-button-secondary"
                >
                  Cancel
                </button>
                {availablePayoutMethods.length > 0 && (
                  <button
                    onClick={() => setShowSelectMethodModal(false)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Video Modal for watching winner videos to unlock payouts */}
        {videoModalAuction && (
          <VideoModal
            isOpen={true}
            onClose={() => setVideoModalAuction(null)}
            auctionId={videoModalAuction.id}
            auctionTitle={videoModalAuction.title}
            onPayoutUnlocked={handlePayoutUnlocked}
          />
        )}
      </div>
    </div>
  )
}