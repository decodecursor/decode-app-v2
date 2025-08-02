'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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
    
    // Navigate after 0.8 seconds to show the full effect
    setTimeout(() => {
      router.push('/payment/create')
    }, 800)
  }


  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUser(user)
      
      // Fetch user role and professional center name from users table
      const { data: userData } = await supabase
        .from('users')
        .select('role, professional_center_name')
        .eq('id', user.id)
        .single()
      
      if (userData) {
        setUserRole(userData.role)
        setProfilePhoto(null) // profile_photo_url field doesn't exist in schema
        setCompanyName(userData.professional_center_name) // use available field
      }
      
      
      setLoading(false)
    }
    
    getUser()
  }, [])

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
      window.location.href = '/auth'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen px-4 py-8">

        {/* Navigation Menu */}
        <div className="mx-auto mb-8" style={{maxWidth: '3000px'}}>
          <div className="cosmic-card">
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center justify-between w-full">
              {/* Left side - Profile Section */}
              <div className="flex items-center gap-4">
                <div className="relative" ref={dropdownRef}>
                  <div 
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="instagram-avatar"
                  >
                    {profilePhoto ? (
                      <img 
                        src={profilePhoto} 
                        alt="Profile" 
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
                    <div className="absolute left-0 mt-2 w-56 bg-gray-800/95 backdrop-blur-lg rounded-xl shadow-lg border border-gray-600/50 py-2 z-50">
                      {/* Profile */}
                      <Link href="/profile" className="w-full flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="nav-button">Profile</span>
                      </Link>

                      {/* Bank Account */}
                      <Link href="/bank-account" className="w-full flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <span className="nav-button">Bank Account</span>
                      </Link>

                      {/* Logout */}
                      <button 
                        onClick={handleSignOut}
                        className="w-full flex items-center px-4 py-3 text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    Anna Hayner
                  </div>
                  <div className="user-info-company">
                    {companyName || 'No company set'}
                  </div>
                </div>
              </div>

              {/* Right side - Navigation Buttons */}
              {userRole === 'Beauty Professional' && (
                <div className="flex gap-4 items-center">
                  {/* Payment History */}
                  <Link 
                    href="/dashboard/payments" 
                    className="nav-button text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    Payment History
                  </Link>
                  
                  {/* My PayLinks */}
                  <Link 
                    href="/my-links" 
                    className="nav-button text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    My PayLinks
                  </Link>
                  
                  {/* Create PayLink - Black Button */}
                  <button 
                    className="create-paylink-button"
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
                    {profilePhoto ? (
                      <img 
                        src={profilePhoto} 
                        alt="Profile" 
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
                      Anna Hayner
                    </div>
                    <div className="user-info-company text-xs">
                      {companyName || 'No company set'}
                    </div>
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
                    
                    {userRole === 'Beauty Professional' && (
                      <>
                        <button 
                          className="block w-full text-left create-paylink-button mb-2"
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
                          className="block nav-button px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          My PayLinks
                        </Link>
                        <Link 
                          href="/dashboard/payments" 
                          className="block nav-button px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Payment History
                        </Link>
                      </>
                    )}
                    
                    {/* Profile */}
                    <Link
                      href="/profile"
                      className="block w-full text-left nav-button px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile
                      </div>
                    </Link>

                    {/* Bank Account */}
                    <Link
                      href="/bank-account"
                      className="block w-full text-left nav-button px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Bank Account
                      </div>
                    </Link>

                    {/* Logout */}
                    <button 
                      onClick={handleSignOut}
                      className="block w-full text-left nav-button px-4 py-3 text-gray-300 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        {/* Main Dashboard Content */}
        <div className="mx-auto space-y-8 mt-[70vh]" style={{maxWidth: '3000px'}}>
          

        </div>
      </div>
    </div>
  )
}