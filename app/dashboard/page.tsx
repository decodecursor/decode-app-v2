'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUser(user)
      
      // Fetch user role from users table
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (userData) {
        setUserRole(userData.role)
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
      <style dangerouslySetInnerHTML={{__html: `
        .magic-button {
          background: linear-gradient(45deg, #667eea, #764ba2);
          border: none;
          padding: 12px 24px;
          border-radius: 25px;
          color: white !important;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
          text-decoration: none !important;
          display: inline-block;
        }

        .magic-button:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
          color: white !important;
          text-decoration: none !important;
        }
      `}} />
      <div className="min-h-screen px-4 py-8">

        {/* Navigation Menu */}
        <div className="mx-auto mb-8" style={{maxWidth: '3000px'}}>
          <div className="cosmic-card">
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center">
              <Link 
                href="/dashboard" 
                className="px-3 py-3 hover:bg-white/10 rounded-lg transition-colors"
              >
                <img 
                  src="/logo.png" 
                  alt="DECODE Logo" 
                  className="h-8 w-auto filter brightness-0 invert"
                />
              </Link>
              
              <div className="flex-1"></div>
              
              {userRole === 'Beauty Professional' && (
                <div className="flex gap-6 items-center">
                  <Link 
                    href="/payment/create" 
                    className="magic-button"
                  >
                    ✨ Create PayLink ✨
                  </Link>
                  <Link 
                    href="/my-links" 
                    className="px-6 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                  >
                    My PayLinks
                  </Link>
                  <Link 
                    href="/dashboard/payments" 
                    className="px-6 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                  >
                    Payment History
                  </Link>
                </div>
              )}
              
              <div className="flex-1"></div>
              
              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="p-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  {/* Salon Chair Icon */}
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-gray-800/95 backdrop-blur-lg rounded-xl shadow-lg border border-gray-600/50 py-2 z-50">
                    {/* Account */}
                    <button className="w-full flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium">Account</span>
                    </button>

                    {/* Wallet */}
                    <Link href="/dashboard/wallet" className="w-full flex items-center px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="font-medium">Wallet</span>
                    </Link>

                    {/* Logout */}
                    <button 
                      onClick={handleSignOut}
                      className="w-full flex items-center px-4 py-3 text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="font-medium">Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </nav>

            {/* Mobile Navigation */}
            <div className="md:hidden">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex items-center justify-between w-full p-4 text-white"
              >
                <span className="font-medium">Menu</span>
                <svg 
                  className={`w-5 h-5 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {mobileMenuOpen && (
                <div className="border-t border-gray-700 pt-4">
                  <nav className="space-y-2">
                    <Link 
                      href="/dashboard" 
                      className="block px-4 py-3 hover:bg-white/10 rounded-lg font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <img 
                        src="/logo.png" 
                        alt="DECODE Logo" 
                        className="h-6 w-auto filter brightness-0 invert"
                      />
                    </Link>
                    
                    {userRole === 'Beauty Professional' && (
                      <>
                        <Link 
                          href="/payment/create" 
                          className="magic-button block mb-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          ✨ Create PayLink ✨
                        </Link>
                        <Link 
                          href="/my-links" 
                          className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          My PayLinks
                        </Link>
                        <Link 
                          href="/dashboard/payments" 
                          className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Payment History
                        </Link>
                      </>
                    )}
                    
                    {/* Account */}
                    <button 
                      className="block w-full text-left px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Account
                      </div>
                    </button>

                    {/* Wallet */}
                    <Link
                      href="/dashboard/wallet"
                      className="block w-full text-left px-4 py-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center">
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Wallet
                      </div>
                    </Link>

                    {/* Logout */}
                    <button 
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-3 text-gray-300 hover:text-red-400 hover:bg-red-500/10 rounded-lg font-medium transition-colors"
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
          

          {/* Recent Activity */}
          <div className="cosmic-card">
            <h2 className="cosmic-heading mb-4 text-white">Recent Activity</h2>
            <div className="text-center py-8">
              <p className="cosmic-body text-white">No transactions yet</p>
              <p className="cosmic-body text-white text-sm mt-2">
                Create your first payment link to get started
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}