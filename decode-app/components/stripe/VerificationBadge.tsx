'use client'

interface VerificationBadgeProps {
  status: 'not_connected' | 'pending' | 'active' | 'restricted' | 'rejected'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function VerificationBadge({ 
  status, 
  size = 'md', 
  showLabel = true,
  className = ''
}: VerificationBadgeProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const renderBadge = () => {
    switch (status) {
      case 'active':
        return (
          <>
            <div className={`${sizeClasses[size]} bg-green-500 rounded-full flex items-center justify-center flex-shrink-0`}>
              <svg className={`${iconSizeClasses[size]} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            {showLabel && <span className={`text-green-400 ${textSizeClasses[size]}`}>Verified</span>}
          </>
        )
      
      case 'pending':
        return (
          <>
            <div className={`${sizeClasses[size]} bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0`}>
              <svg className={`${iconSizeClasses[size]} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {showLabel && <span className={`text-yellow-400 ${textSizeClasses[size]}`}>Pending Verification</span>}
          </>
        )
      
      case 'restricted':
        return (
          <>
            <div className={`${sizeClasses[size]} bg-red-500 rounded-full flex items-center justify-center flex-shrink-0`}>
              <span className={`text-white font-bold ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm'}`}>!</span>
            </div>
            {showLabel && <span className={`text-red-400 ${textSizeClasses[size]}`}>Action Required</span>}
          </>
        )
      
      case 'rejected':
        return (
          <>
            <div className={`${sizeClasses[size]} bg-red-600 rounded-full flex items-center justify-center flex-shrink-0`}>
              <svg className={`${iconSizeClasses[size]} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            {showLabel && <span className={`text-red-400 ${textSizeClasses[size]}`}>Rejected</span>}
          </>
        )
      
      default:
        return (
          <>
            <div className={`${sizeClasses[size]} bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0`}>
              <svg className={`${iconSizeClasses[size]} text-gray-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            {showLabel && <span className={`text-gray-400 ${textSizeClasses[size]}`}>Not Connected</span>}
          </>
        )
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {renderBadge()}
    </div>
  )
}