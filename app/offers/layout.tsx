'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useState, useRef, useEffect } from 'react'

const CITIES = ['UAE', 'Dubai', 'Abu Dhabi', 'Sharjah', 'Ras Al Khaimah', 'Al Ain'] as const

function OffersLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedCity = searchParams.get('city') || 'UAE'

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const selectCity = (city: string) => {
    setOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    if (city === 'UAE') {
      params.delete('city')
    } else {
      params.set('city', city)
    }
    const qs = params.toString()
    router.push(`/offers${qs ? `?${qs}` : ''}`)
  }

  // Don't show header on redeem pages (merchant-facing)
  const isRedeemPage = pathname?.startsWith('/offers/redeem')

  return (
    <div className="offers-dark-theme min-h-screen">
      {!isRedeemPage && (
        <header className="offers-header sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            {/* Logo / Brand */}
            <Link href="/offers" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="DECODE"
                style={{ height: '20px', filter: 'brightness(0) invert(1)', opacity: 0.9 }}
              />
              <div className="w-[1px] h-[20px] bg-white/40" />
              <span className="text-[13px] font-medium text-white/40 tracking-wide uppercase">Offers</span>
            </Link>

            {/* Right nav */}
            <div className="flex items-center gap-4">
              {/* City Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setOpen(!open)}
                  className={`text-[13px] md:text-[14px] font-medium transition-colors flex items-center gap-1 ${
                    pathname === '/offers'
                      ? 'text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {selectedCity}
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {open && (
                  <div className="absolute right-0 top-full mt-2 min-w-[160px] rounded-lg border border-white/10 bg-[#1a1a1a] shadow-xl overflow-hidden">
                    {CITIES.map((city) => (
                      <button
                        key={city}
                        onClick={() => selectCity(city)}
                        className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${
                          selectedCity === city
                            ? 'text-white bg-white/10'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/offers/my-deals"
                className={`text-[13px] md:text-[14px] font-medium transition-colors ${
                  pathname?.startsWith('/offers/my-deals')
                    ? 'text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                My Deals
              </Link>
            </div>
          </div>
        </header>
      )}

      <main>{children}</main>
    </div>
  )
}

export default function OffersLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <OffersLayoutInner>{children}</OffersLayoutInner>
    </Suspense>
  )
}
