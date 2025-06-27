'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/payment/create', label: 'Create Payment' },
    { href: '/dashboard/analytics', label: 'Analytics' },
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
            className="cosmic-button-secondary"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}