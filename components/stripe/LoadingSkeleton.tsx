'use client'

interface LoadingSkeletonProps {
  type: 'account-overview' | 'bank-cards' | 'form'
}

export function LoadingSkeleton({ type }: LoadingSkeletonProps) {
  if (type === 'account-overview') {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 backdrop-blur-sm">
        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="h-8 w-48 bg-gray-700/50 rounded-lg animate-pulse mb-2" />
              <div className="h-4 w-64 bg-gray-700/30 rounded animate-pulse" />
            </div>
            <div className="h-10 w-32 bg-gray-700/50 rounded-full animate-pulse" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-xl p-6">
              <div className="h-4 w-24 bg-gray-700/30 rounded animate-pulse mb-2" />
              <div className="h-10 w-40 bg-gray-700/50 rounded-lg animate-pulse" />
            </div>
            <div className="bg-white/5 rounded-xl p-6">
              <div className="h-4 w-24 bg-gray-700/30 rounded animate-pulse mb-2" />
              <div className="h-8 w-32 bg-gray-700/50 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'bank-cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="space-y-4">
              <div>
                <div className="h-5 w-32 bg-gray-700/50 rounded animate-pulse mb-1" />
                <div className="h-4 w-24 bg-gray-700/30 rounded animate-pulse" />
              </div>
              <div>
                <div className="h-3 w-20 bg-gray-700/30 rounded animate-pulse mb-1" />
                <div className="h-5 w-28 bg-gray-700/50 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="cosmic-card">
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="h-4 w-24 bg-gray-700/30 rounded animate-pulse mb-2" />
            <div className="h-10 w-full bg-gray-700/50 rounded-lg animate-pulse" />
          </div>
        ))}
        <div className="h-12 w-32 bg-purple-600/50 rounded-lg animate-pulse mt-6" />
      </div>
    </div>
  )
}