'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function OffersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

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
              <div className="w-[2px] h-[20px] bg-white/40" />
              <span className="text-xs font-medium text-white/40 tracking-wide uppercase">Offers</span>
            </Link>

            {/* Right nav */}
            <div className="flex items-center gap-4">
              <Link
                href="/offers"
                className={`text-xs font-medium transition-colors ${
                  pathname === '/offers'
                    ? 'text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                Browse
              </Link>
              <Link
                href="/offers/my-deals"
                className={`text-xs font-medium transition-colors ${
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
