'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useUser } from '@/providers/UserContext'
import { USER_ROLES } from '@/types/user'
import { EmailVerificationGate } from '@/components/EmailVerificationGate'


export default function Dashboard() {
  const supabase = createClient()
  const { user, profile, loading: contextLoading, refreshProfile } = useUser()
  const [pendingUsersCount, setPendingUsersCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [profileWaitCount, setProfileWaitCount] = useState(0)
  const [isNewUser, setIsNewUser] = useState(false)
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


  // Check authentication on mount
  useEffect(() => {
    console.log('🔄 [DASHBOARD] State change:', {
      contextLoading,
      hasUser: !!user,
      hasProfile: !!profile,
      profileApprovalStatus: profile?.approval_status,
      profileRole: profile?.role
    })

    if (!contextLoading) {
      if (!user) {
        console.log('❌ [DASHBOARD] No user found, redirecting to auth')
        router.push('/auth')
        return
      }

      console.log('✅ [DASHBOARD] User authenticated, checking profile...')

      // Note: Profile is automatically created by database trigger during registration
      // No need to redirect to profile setup - users should stay on dashboard

      // Check if user is approved (skip check for Admins) - only if profile exists
      if (profile?.approval_status === 'pending' && profile?.role !== USER_ROLES.ADMIN) {
        console.log('⏳ [DASHBOARD] User pending approval, redirecting to pending page')
        window.location.href = '/pending-approval'
        return
      }

      // Set pending users count for admins
      if (profile?.role === USER_ROLES.ADMIN && profile?.pendingUsersCount !== undefined) {
        console.log('👑 [DASHBOARD] Admin user, setting pending count:', profile?.pendingUsersCount)
        setPendingUsersCount(profile?.pendingUsersCount)
      }

      console.log('✅ [DASHBOARD] Setup complete, rendering dashboard')
    }
  }, [contextLoading, user, profile, router])

  // Set up polling-based real-time updates for pending users
  useEffect(() => {
    if (profile?.role === USER_ROLES.ADMIN && profile?.company_name) {
      // Set up polling every 30 seconds
      const pollInterval = setInterval(async () => {
        // Only poll if page is visible to save resources
        if (document.visibilityState === 'visible') {
          await refreshProfile()
        }
      }, 30000) // 30 seconds

      // Cleanup on component unmount
      return () => {
        clearInterval(pollInterval)
      }
    }

    return () => {}
  }, [profile?.role, profile?.company_name, refreshProfile])

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

  // Refresh profile when window regains focus (user returns from profile page)
  useEffect(() => {
    const handleWindowFocus = () => {
      // Only refresh if user exists and page is visible
      if (user && document.visibilityState === 'visible') {
        refreshProfile()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [user, refreshProfile])

  // Check if user just completed registration (detect new user)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const newUserFlag = urlParams.get('new_user') === 'true'

      // ONLY detect new user from explicit URL parameter
      // Do NOT use referrer check as it catches login users too
      if (newUserFlag) {
        setIsNewUser(true)
        // Clear the URL parameter to avoid affecting refreshes
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, [])

  // Effect to wait for profile loading ONLY for newly registered users
  useEffect(() => {
    if (isNewUser && user && profile === null && profileWaitCount < 6) { // 6 * 500ms = 3 seconds
      const timer = setTimeout(() => {
        setProfileWaitCount(prev => prev + 1)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isNewUser, user, profile, profileWaitCount])

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


  // Show loading spinner while context is loading or if no user yet
  if (contextLoading || !user) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-300">
              {contextLoading ? 'Loading dashboard...' : 'Authenticating...'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ONLY for newly registered users, wait for profile to load before showing dashboard
  // This prevents showing "No name set", "No company set" for new users
  // Existing users bypass this and show dashboard even if profile is null
  if (isNewUser && user && profile === null && profileWaitCount < 6) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-300">Loading your profile...</p>
            <p className="text-gray-400 text-sm mt-2">Setting up your dashboard...</p>
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
                    {profile?.companyProfileImage ? (
                      <img 
                        src={profile?.companyProfileImage} 
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
                    {profile?.user_name || 'Loading...'}
                  </div>
                  <div className="user-info-company">
                    {profile?.company_name || 'Loading...'}
                  </div>
                  {profile?.role ? (
                    <div className="text-xs text-gray-400">
                      {profile?.role}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">
                      Loading...
                    </div>
                  )}
                  {/* Show retry button if profile failed to load for existing users */}
                  {!isNewUser && !profile && user && (
                    <button
                      onClick={() => refreshProfile()}
                      className="text-xs text-purple-400 hover:text-purple-300 mt-1"
                    >
                      Retry loading profile
                    </button>
                  )}
                </div>
              </div>

              {/* Right side - Navigation Buttons */}
              {/* Show navigation based on role, or default navigation if no profile yet */}
              {profile?.role === USER_ROLES.ADMIN ? (
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
              ) : profile?.role === USER_ROLES.STAFF ? (
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
              ) : (
                // Default navigation for users without profile yet (new users)
                <div className="flex gap-4 items-center">
                  {/* Basic navigation available to all users */}
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
                    {profile?.companyProfileImage ? (
                      <img 
                        src={profile?.companyProfileImage} 
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
                      {profile?.user_name || 'Loading...'}
                    </div>
                    <div className="user-info-company text-xs">
                      {profile?.company_name || 'Loading...'}
                    </div>
                    {profile?.role ? (
                      <div className="text-xs text-gray-400">
                        {profile?.role}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">
                        Loading...
                      </div>
                    )}
                    {/* Show retry button if profile failed to load for existing users */}
                    {!isNewUser && !profile && user && (
                      <button
                        onClick={() => refreshProfile()}
                        className="text-xs text-purple-400 hover:text-purple-300 mt-1 text-left"
                      >
                        Retry
                      </button>
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

                    {/* Always show Create PayLink button */}
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

                    {/* Always show PayLinks */}
                    <Link
                      href="/my-links"
                      className="block nav-button px-2 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      PayLinks
                    </Link>

                    {/* Show Earnings for Admin and Staff roles */}
                    {(profile?.role === USER_ROLES.ADMIN || profile?.role === USER_ROLES.STAFF) && (
                      <Link
                        href="/dashboard/payments"
                        className="block nav-button px-2 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Earnings
                      </Link>
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

        </div>
      </div>
    </EmailVerificationGate>
  )
}