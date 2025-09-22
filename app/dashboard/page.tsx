'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
import { User } from '@supabase/supabase-js'
import { UserRole, USER_ROLES, validateUserProfile, normalizeRole } from '@/types/user'
import { EmailVerificationGate } from '@/components/EmailVerificationGate'
import PaymentStats from '@/components/dashboard/PaymentStats'
import { ErrorBoundary } from '@/components/ErrorBoundary'


export default function Dashboard() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [companyProfileImage, setCompanyProfileImage] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userBranch, setUserBranch] = useState<string | null>(null)
  const [pendingUsersCount, setPendingUsersCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [paymentLinks, setPaymentLinks] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [paymentDataLoading, setPaymentDataLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  // Format amount with thousands separators
  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  // Magic button functions with SSR compatibility
  const createHoverSparkles = (event: React.MouseEvent) => {
    if (typeof window === 'undefined') return
    
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current)
    }
    
    const button = event.target as HTMLElement
    const rect = button.getBoundingClientRect()
    
    const sparkleCount = 3 + Math.floor(Math.random() * 3)
    
    for (let i = 0; i < sparkleCount; i++) {
      setTimeout(() => {
        if (typeof window === 'undefined') return
        
        const sparkle = document.createElement('div')
        sparkle.className = 'hover-sparkle'
        
        const x = rect.left + Math.random() * rect.width
        const y = rect.top + Math.random() * rect.height
        
        sparkle.style.left = x + 'px'
        sparkle.style.top = y + 'px'
        
        document.body.appendChild(sparkle)
        
        setTimeout(() => {
          if (sparkle.parentNode) {
            sparkle.parentNode.removeChild(sparkle)
          }
        }, 1000)
      }, i * 100)
    }
    
    hoverTimeout.current = setTimeout(() => {
      if (typeof window !== 'undefined' && button.matches(':hover')) {
        createHoverSparkles(event)
      }
    }, 800)
  }

  const createMagicalStarExplosion = (event: React.MouseEvent) => {
    if (typeof window === 'undefined') return
    
    const button = event.target as HTMLElement
    const rect = button.getBoundingClientRect()
    
    const totalStars = 25
    const starTypes = ['star-sparkle', 'star-dot', 'star-diamond', 'star-triangle', 'click-star']
    const animations = ['magic-fly-1', 'magic-fly-2', 'magic-fly-3', 'magic-fly-4', 'magic-fly-5', 'magic-spiral']
    
    for (let i = 0; i < totalStars; i++) {
      setTimeout(() => {
        if (typeof window === 'undefined') return
        
        const star = document.createElement('div')
        
        const starType = starTypes[Math.floor(Math.random() * starTypes.length)]
        star.className = `click-star ${starType}`
        
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const x = centerX + (Math.random() - 0.5) * 40
        const y = centerY + (Math.random() - 0.5) * 40
        
        star.style.left = x + 'px'
        star.style.top = y + 'px'
        
        const animation = animations[Math.floor(Math.random() * animations.length)]
        star.classList.add(animation || 'magic-fly-1')
        
        const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#fff']
        if (starType === 'star-dot') {
          star.style.background = colors[Math.floor(Math.random() * colors.length)] || '#ffd700'
        }
        
        document.body.appendChild(star)
        
        setTimeout(() => {
          if (star.parentNode) {
            star.parentNode.removeChild(star)
          }
        }, 2500)
      }, i * 30)
    }
    
    button.style.animation = 'none'
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        button.style.animation = 'buttonShake 0.5s ease-in-out'
      }
    }, 10)
  }

  const handleCreatePayLinkClick = (event: React.MouseEvent) => {
    event.preventDefault()
    createMagicalStarExplosion(event)
    
    // Navigate after 0.6 seconds to show the full effect
    setTimeout(() => {
      router.push('/payment/create')
    }, 600)
  }


  // Load user data when user is available
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) {
        console.log('🚪 Dashboard: No user, waiting for auth...')
        return
      }

      try {
        console.log('🔍 Dashboard: Loading user data for:', user.id)
        setLoading(true)

        // Use proxy endpoint to fetch user profile data
        console.log('🔍 [DASHBOARD DEBUG] Fetching profile for user:', user.id)
        const response = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include'
        })

        console.log('🔍 [DASHBOARD DEBUG] Response status:', response.status)
        console.log('🔍 [DASHBOARD DEBUG] Response ok:', response.ok)

        if (!response.ok) {
          const errorData = await response.json()
          console.error('⚠️ Dashboard: Failed to fetch profile:', errorData.error)

          // If no profile exists, redirect to profile setup
          if (response.status === 404 || errorData.error === 'NO_PROFILE') {
            router.push('/profile')
            return
          }
          setLoading(false)
          return
        }

        const fullDashboardResponse = await response.json()
        console.log('🔍 [DASHBOARD DEBUG] Full API response:', JSON.stringify(fullDashboardResponse, null, 2))

        const { userData } = fullDashboardResponse
        console.log('✅ Dashboard: Profile data received:', userData)
        console.log('🔍 [DASHBOARD DEBUG] userData.branch_name:', userData?.branch_name)

        // Validate and normalize user profile data
        const validatedProfile = validateUserProfile(userData)

        console.log('✅ Dashboard: Validated role:', validatedProfile.role)
        console.log('🔍 Dashboard: Setting userRole state to:', validatedProfile.role)
        setUserRole(validatedProfile.role)

        setCompanyName(validatedProfile.company_name || validatedProfile.professional_center_name)
        setUserName(validatedProfile.user_name)

        // Set user branch (first branch if multiple)
        if (validatedProfile.branch_name) {
          const branches = validatedProfile.branch_name.split(',').map((b: string) => b.trim()).filter((b: string) => b !== '')
          setUserBranch(branches[0] || null)
        } else {
          setUserBranch(null)
        }

        // Set company profile image if available
        if (validatedProfile.companyProfileImage) {
          setCompanyProfileImage(validatedProfile.companyProfileImage)
        }

        // Check if user is approved (skip check for Admins)
        if (validatedProfile.approval_status === 'pending' && validatedProfile.role !== USER_ROLES.ADMIN) {
          window.location.href = '/pending-approval'
          return
        }

        // Set pending users count for admins
        if (validatedProfile.role === USER_ROLES.ADMIN && validatedProfile.pendingUsersCount !== undefined) {
          setPendingUsersCount(validatedProfile.pendingUsersCount)
        }
      
      
      setLoading(false)
    } catch (error) {
      console.error('💥 Dashboard: Failed to load user data:', error)
      setLoading(false)
    }
    }

    loadUserData()
  }, [user, router, supabase])

  // Set up polling-based real-time updates for pending users
  useEffect(() => {
    if (userRole === USER_ROLES.ADMIN && companyName) {
      const fetchPendingCount = async () => {
        try {
          // Use proxy endpoint to get updated counts
          const response = await fetch('/api/user/profile', {
            method: 'GET',
            credentials: 'include'
          })

          if (response.ok) {
            const { userData } = await response.json()
            if (userData && userData.pendingUsersCount !== undefined) {
              setPendingUsersCount(userData.pendingUsersCount)
            }
          }
        } catch (error) {
          console.error('Error fetching pending users count:', error)
        }
      }

      // Initial fetch
      fetchPendingCount()
      
      // Set up polling every 30 seconds
      const pollInterval = setInterval(() => {
        // Only poll if page is visible to save resources
        if (document.visibilityState === 'visible') {
          fetchPendingCount()
        }
      }, 30000) // 30 seconds

      // Cleanup on component unmount
      return () => {
        clearInterval(pollInterval)
      }
    }
    
    return () => {}
  }, [userRole, companyName])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      console.log('✅ Signed out successfully')
      router.push('/auth')
    } catch (error) {
      console.error('Error signing out:', error)
      router.push('/auth')
    }
  }

  // Fetch payment data for analytics
  const fetchPaymentData = async () => {
    if (!user) {
      console.log('📊 Dashboard: No user, skipping payment data fetch')
      return
    }

    try {
      console.log('📊 Dashboard: Fetching payment data...')
      setPaymentDataLoading(true)

      const response = await fetch('/api/payment-history/data', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Dashboard: Payment data fetch failed:', errorData)
        return
      }

      const data = await response.json()
      console.log('✅ Dashboard: Payment data received:', {
        paymentLinks: data.paymentLinks?.length || 0,
        transactions: data.transactions?.length || 0,
        isAdmin: data.isAdmin,
        companyName: data.companyName
      })

      setPaymentLinks(data.paymentLinks || [])
      setTransactions(data.transactions || [])
    } catch (error) {
      console.error('❌ Dashboard: Error fetching payment data:', error)
    } finally {
      setPaymentDataLoading(false)
    }
  }

  // Fetch payment data when user and role are loaded
  useEffect(() => {
    if (user && userRole) {
      console.log('📊 Dashboard: User and role ready, fetching payment data')
      fetchPaymentData()
    }
  }, [user, userRole])

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthError(null)
        const { user: authUser, error } = await getUserWithProxy()

        if (error) {
          console.error('🚫 Dashboard: Authentication error:', error)
          setAuthError('Authentication failed. Please try again.')
          return
        }

        if (!authUser) {
          console.log('🚪 Dashboard: No authenticated user, redirecting to auth')
          // Don't redirect immediately, give user a chance to see error and retry
          setAuthError('No authenticated user found. Please log in.')
          setTimeout(() => router.push('/auth'), 3000)
          return
        }

        console.log('✅ Dashboard: User authenticated:', authUser.id)
        setUser(authUser)
      } catch (error) {
        console.error('❌ Auth check failed:', error)
        setAuthError('Failed to check authentication. Please try again.')
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [router])

  // Show loading spinner while checking authentication or loading data
  if (authLoading || loading) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-300">{authLoading ? 'Authenticating...' : 'Loading dashboard...'}</p>
          </div>
        </div>
      </div>
    )
  }

  // Show authentication error state
  if (authError && !authLoading) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="cosmic-heading text-white mb-2">Authentication Issue</h2>
            <p className="cosmic-body text-white/70 mb-6">{authError}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/auth')}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Ensure user exists before rendering - show fallback instead of null
  if (!user) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="cosmic-heading text-white mb-2">Loading User Data</h2>
            <p className="cosmic-body text-white/70 mb-4">Please wait while we load your account...</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }


  return (
    <EmailVerificationGate
      userId={user?.id}
      userEmail={user?.email}
    >
      <div className="cosmic-bg">
        <div className="min-h-screen px-4 py-8">

        {/* Navigation Menu */}
        <div className="mx-auto mb-8" style={{maxWidth: '3000px'}}>
          <div className="cosmic-card" style={{padding: '10px 17px'}}>
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center justify-between w-full">
              {/* Left side - Profile Section */}
              <div className="flex items-center gap-4">
                <div className="relative" ref={dropdownRef}>
                  <div 
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="instagram-avatar"
                  >
                    {companyProfileImage ? (
                      <img 
                        src={companyProfileImage} 
                        alt="Company Profile" 
                      />
                    ) : (
                      <div className="avatar-fallback">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Dropdown Menu */}
                  {profileDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-64 bg-gray-800/95 backdrop-blur-lg rounded-xl shadow-lg border border-gray-600/50 py-2 z-50">
                      {/* Profile */}
                      <Link href="/profile" className="w-full flex items-center px-5 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="nav-button">Profile</span>
                      </Link>


                      {/* Payouts */}
                      <Link href="/dashboard/payouts" className="w-full flex items-center px-5 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2a2 2 0 002 2z" />
                        </svg>
                        <span className="nav-button">Payouts</span>
                      </Link>

                      {/* Logout */}
                      <button 
                        onClick={handleSignOut}
                        className="w-full flex items-center px-5 py-1.5 text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="nav-button">Logout</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* User Info Text */}
                <div className="flex flex-col justify-center">
                  <div className="user-info-name">
                    {userName || 'No name set'}
                  </div>
                  <div className="user-info-company">
                    {companyName || 'No company set'}
                  </div>
                  {(userRole || userBranch) && (
                    <div className="text-xs text-gray-400">
                      {userRole === USER_ROLES.ADMIN ? userRole : (userBranch || userRole)}
                    </div>
                  )}
                </div>
              </div>

              {/* Right side - Navigation Buttons */}
              {userRole === USER_ROLES.ADMIN && (
                <div className="flex gap-4 items-center">
                  {/* Users Management */}
                  <Link 
                    href="/dashboard/users" 
                    className="nav-button text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors relative"
                  >
                    Users
                    {pendingUsersCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                        {pendingUsersCount}
                      </span>
                    )}
                  </Link>
                  
                  {/* Payment History */}
                  <Link 
                    href="/dashboard/payments" 
                    className="nav-button text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    Earnings
                  </Link>
                  
                  {/* My PayLinks */}
                  <Link 
                    href="/my-links" 
                    className="nav-button text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    PayLinks
                  </Link>
                  
                  {/* Create PayLink - Black Button */}
                  <button 
                    className="bg-gradient-to-br from-gray-800 to-black text-white border-none rounded-lg text-[17px] font-medium px-6 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-gray-600 hover:to-gray-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                    onMouseOver={createHoverSparkles}
                    onClick={handleCreatePayLinkClick}
                  >
                    Create PayLink
                  </button>
                </div>
              )}

              {/* User Navigation Buttons */}
              {userRole === USER_ROLES.STAFF && (
                <div className="flex gap-4 items-center">
                  {/* Payment History */}
                  <Link 
                    href="/dashboard/payments" 
                    className="nav-button text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    Earnings
                  </Link>
                  
                  {/* My PayLinks */}
                  <Link 
                    href="/my-links" 
                    className="nav-button text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    PayLinks
                  </Link>
                  
                  {/* Create PayLink - Black Button */}
                  <button 
                    className="bg-gradient-to-br from-gray-800 to-black text-white border-none rounded-lg text-[17px] font-medium px-6 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-gray-600 hover:to-gray-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                    onMouseOver={createHoverSparkles}
                    onClick={handleCreatePayLinkClick}
                  >
                    Create PayLink
                  </button>
                </div>
              )}
            </nav>

            {/* Mobile Navigation */}
            <div className="md:hidden">
              <div className="flex items-center justify-between p-4">
                {/* Mobile Profile Section */}
                <div className="flex items-center gap-3">
                  <div 
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="instagram-avatar"
                  >
                    {companyProfileImage ? (
                      <img 
                        src={companyProfileImage} 
                        alt="Company Profile" 
                      />
                    ) : (
                      <div className="avatar-fallback">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Mobile User Info Text */}
                  <div className="flex flex-col justify-center">
                    <div className="user-info-name text-base">
                      {userName || 'No name set'}
                    </div>
                    <div className="user-info-company text-xs">
                      {companyName || 'No company set'}
                    </div>
                    {userRole && (
                      <div className="text-xs text-gray-400">
                        {userRole}
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-white"
                >
                  <svg 
                    className={`w-6 h-6 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
              
              {mobileMenuOpen && (
                <div className="border-t border-gray-700 pt-4">
                  <nav className="space-y-2">
                    
                    {userRole === USER_ROLES.ADMIN && (
                      <>
                        <button 
                          className="block w-full text-left bg-gradient-to-br from-gray-800 to-black text-white border-none rounded-lg text-[17px] font-medium px-6 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-gray-600 hover:to-gray-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] mb-2"
                          onMouseOver={createHoverSparkles}
                          onClick={(e) => {
                            setMobileMenuOpen(false)
                            handleCreatePayLinkClick(e)
                          }}
                        >
                          Create PayLink
                        </button>
                        <Link 
                          href="/my-links" 
                          className="block nav-button px-2 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          PayLinks
                        </Link>
                        <Link 
                          href="/dashboard/payments" 
                          className="block nav-button px-2 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Earnings
                        </Link>
                      </>
                    )}
                    
                    {/* Profile */}
                    <Link
                      href="/profile"
                      className="block w-full text-left nav-button px-5 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile
                      </div>
                    </Link>


                    {/* Payouts */}
                    <Link
                      href="/dashboard/payouts"
                      className="block w-full text-left nav-button px-5 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2a2 2 0 002 2z" />
                        </svg>
                        Payouts
                      </div>
                    </Link>

                    {/* Logout */}
                    <button 
                      onClick={handleSignOut}
                      className="block w-full text-left nav-button px-5 py-1.5 text-gray-300 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </div>
                    </button>
                  </nav>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Dashboard Content - Analytics */}
        <div className="container mx-auto px-4 py-8">
          <ErrorBoundary>
            <PaymentStats
              transactions={transactions}
              paymentLinks={paymentLinks}
              user={user}
              userRole={userRole}
            />
          </ErrorBoundary>
        </div>
        </div>
      </div>
    </EmailVerificationGate>
  )
}