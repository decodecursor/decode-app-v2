'use client'

import { ReactNode } from 'react'

interface ProtectedFeatureProps {
  children: ReactNode
  isVerified: boolean
  featureName?: string
  showPreview?: boolean
  className?: string
}

export function ProtectedFeature({
  children,
  isVerified,
  featureName = 'this feature',
  showPreview = true,
  className = ''
}: ProtectedFeatureProps) {
  if (isVerified) {
    return <>{children}</>
  }

  if (!showPreview) {
    return null
  }

  return (
    <div className={`relative ${className}`}>
      {/* Render children with overlay */}
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>

      {/* Verification Required Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-lg">
        <div className="text-center p-6">
          <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9.5m4.5-7.5V7a2 2 0 00-2-2H7a2 2 0 00-2 2v2.5M12 10V7" />
            </svg>
          </div>
          <h3 className="text-white font-medium mb-2">Email Verification Required</h3>
          <p className="text-gray-300 text-sm">
            Verify your email to access {featureName}
          </p>
        </div>
      </div>
    </div>
  )
}