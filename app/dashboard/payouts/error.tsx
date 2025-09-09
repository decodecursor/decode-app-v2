'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="cosmic-bg min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="cosmic-card text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="cosmic-heading text-white mb-2">Error Loading Payouts</h2>
          <p className="cosmic-body text-white/70 mb-4">
            {error.message || 'Something went wrong loading the payouts page'}
          </p>
          <button 
            onClick={reset}
            className="cosmic-button-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  )
}