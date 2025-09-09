'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { User } from '@supabase/supabase-js'


export default function Dashboard() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [companyProfileImage, setCompanyProfileImage] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userBranch, setUserBranch] = useState<string | null>(null)
  const [pendingUsersCount, setPendingUsersCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
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


  useEffect(() => {
    const getUser = async () => {
      try {
        console.log('🔍 Dashboard: Checking user authentication...')
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('❌ Dashboard: Auth error:', error)
          setAuthLoading(false)
          router.push('/auth')
          return
        }
        
        if (!user) {
          console.log('🚪 Dashboard: No user found, redirecting to auth')
          setAuthLoading(false)
          router.push('/auth')
          return
        }
        
        console.log('✅ Dashboard: User authenticated:', user.id)
        setUser(user)
      
      // Fetch user role, professional center name, and profile photo from users table
      const { data: userData } = await supabase
        .from('users')
        .select('role, professional_center_name, user_name, company_name, approval_status, branch_name')
        .eq('id', user.id)
        .single() as { data: any, error: any }
      
      if (userData) {
        setUserRole(userData.role)
        setCompanyName(userData.company_name || userData.professional_center_name) // prefer company_name
        setUserName(userData.user_name)
        
        // Set user branch (first branch if multiple)
        if (userData.branch_name) {
          const branches = userData.branch_name.split(',').map((b: string) => b.trim()).filter((b: string) => b !== '')
          setUserBranch(branches[0] || null)
        } else {
          setUserBranch(null)
        }
        
        // Fetch company profile image from admin user in same company
        const currentCompanyName = userData.company_name || userData.professional_center_name
        if (currentCompanyName) {
          try {
            const { data: adminWithPhoto, error } = await supabase
              .from('users')
              .select('profile_photo_url')
              .eq('company_name', currentCompanyName)
              .eq('role', 'Admin')
              .not('profile_photo_url', 'is', null)
              .limit(1)
              .maybeSingle() // Use maybeSingle instead of single to avoid errors when no rows found
            
            // Type guard with explicit casting to handle RLS/permissions issues
            if (!error && adminWithPhoto && typeof adminWithPhoto === 'object') {
              const photoData = adminWithPhoto as { profile_photo_url?: string }
              if (photoData.profile_photo_url) {
                setCompanyProfileImage(photoData.profile_photo_url)
              }
            }
          } catch (error) {
            console.log('Could not fetch company profile image:', error)
            // Continue without company image - will show default avatar
          }
        }
        
        // Check if user is approved (skip check for Admins)
        if (userData.approval_status === 'pending' && userData.role !== 'Admin') {
          window.location.href = '/pending-approval'
          return
        }
        
        // If admin, get pending users count for notifications
        if (userData.role === 'Admin' && userData.company_name) {
          const fetchPendingCount = async () => {
            const { count } = await supabase
              .from('users')
              .select('*', { count: 'exact', head: true })
              .eq('company_name', userData.company_name)
              .eq('approval_status', 'pending')
            setPendingUsersCount(count || 0)
          }
          fetchPendingCount()
        }
      }
      
      
      setLoading(false)
      setAuthLoading(false)
    } catch (error) {
      console.error('💥 Dashboard: Failed to load user data:', error)
      setAuthLoading(false)
      router.push('/auth')
    }
    }
    
    getUser()
  }, [])

  // Set up polling-based real-time updates for pending users
  useEffect(() => {
    if (userRole === 'Admin' && companyName) {
      const fetchPendingCount = async () => {
        try {
          const { count } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('company_name', companyName)
            .eq('approval_status', 'pending')
          setPendingUsersCount(count || 0)
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
      
      // Refresh immediately when page becomes visible
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          fetchPendingCount()
        }
      }
      
      document.addEventListener('visibilitychange', handleVisibilityChange)
      
      // Cleanup on component unmount
      return () => {
        clearInterval(pollInterval)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
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
      router.push('/auth')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-300">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
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

                      {/* Bank Account - Admin Only */}
                      {userRole === 'Admin' && (
                        <Link href="/bank-account" className="w-full flex items-center px-5 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          <span className="nav-button">Bank Account</span>
                        </Link>
                      )}

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
                      {userRole === 'Admin' ? userRole : (userBranch || userRole)}
                    </div>
                  )}
                </div>
              </div>

              {/* Right side - Navigation Buttons */}
              {userRole === 'Admin' && (
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
              {userRole === 'User' && (
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
                    
                    {userRole === 'Admin' && (
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

                    {/* Bank Account - Admin Only */}
                    {userRole === 'Admin' && (
                      <Link
                        href="/bank-account"
                        className="block w-full text-left nav-button px-5 py-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <div className="flex items-center">
                          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          Bank Account
                        </div>
                      </Link>
                    )}

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

        {/* Main Dashboard Content - EMPTY */}
        <div className="container mx-auto px-4 py-8 mt-[70vh]">
          {/* Dashboard content intentionally empty per user request */}
        </div>
      </div>
    </div>
  )
}