'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useUser } from '@/providers/UserContext'
import { USER_ROLES } from '@/types/user'

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { profile } = useUser()

  const handleSignOut = async () => {
    try {
      // Clear all session data
      localStorage.removeItem('supabase_backup_session')
      localStorage.removeItem('sb-auth-token')
      console.log('🗑️ Cleared all session data')

      // Sign out from Supabase
      await supabase.auth.signOut()
      console.log('✅ Signed out successfully')
    } catch (error) {
      console.error('Error during sign out:', error)
    } finally {
      router.push('/auth')
    }
  }

  // Dynamic navigation items based on user role
  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/payment/create', label: 'Create Payment' },
    { href: '/dashboard/analytics', label: 'Analytics' },
    // Add USERS page for admin users only
    ...(profile?.role === USER_ROLES.ADMIN ? [
      { href: '/dashboard/users', label: 'Users' }
    ] : []),
    // Add AUCTIONS page for MODEL users only
    ...(profile?.role === USER_ROLES.MODEL ? [
      { href: '/dashboard/auctions', label: 'Auctions' }
    ] : [])
  ]

  return (
    <div className="cosmic-card mb-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-8">
          <Link href="/dashboard" className="cosmic-logo text-2xl hover:opacity-80 transition-opacity">
            DECODE
          </Link>
          
          <nav className="hidden md:flex space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`cosmic-body transition-all duration-200 ${
                  pathname === item.href
                    ? 'text-white opacity-100 border-b border-white/50 pb-1'
                    : 'text-white/70 hover:text-white hover:opacity-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <select
              onChange={(e) => router.push(e.target.value)}
              value={pathname}
              className="cosmic-input py-2 text-sm"
            >
              {navItems.map((item) => (
                <option key={item.href} value={item.href}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white/5 text-red-400 rounded-lg hover:bg-white/10 hover:text-red-300 transition-colors border border-white/10"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}