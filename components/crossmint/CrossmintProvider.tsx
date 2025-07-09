'use client'

import React from 'react'
import { crossmintConfig, logCrossmintConfigStatus } from '@/lib/crossmint-config'
// No CrossmintProvider needed - using components directly

interface CrossmintProviderProps {
  children: React.ReactNode
}

export function CrossmintProvider({ children }: CrossmintProviderProps) {
  React.useEffect(() => {
    // Log configuration status in development
    if (process.env.NODE_ENV === 'development') {
      logCrossmintConfigStatus()
    }
  }, [])

  // No provider needed - just pass through children
  return <>{children}</>
}

// Fallback provider component for development
function FallbackProvider({ children }: CrossmintProviderProps) {
  const contextValue = React.useMemo(() => ({
    isConfigured: !!crossmintConfig.apiKey,
    environment: crossmintConfig.environment,
    apiKey: crossmintConfig.apiKey ? 'configured' : 'missing',
    developmentMode: true
  }), [])

  return (
    <CrossmintContext.Provider value={contextValue}>
      {children}
    </CrossmintContext.Provider>
  )
}

// Context for accessing Crossmint configuration
const CrossmintContext = React.createContext<{
  isConfigured: boolean
  environment: string
  apiKey: string
  developmentMode?: boolean
} | null>(null)

// Hook to use Crossmint context
export function useCrossmint() {
  const context = React.useContext(CrossmintContext)
  
  if (!context) {
    throw new Error('useCrossmint must be used within a CrossmintProvider')
  }
  
  return context
}

// Configuration status component
export function CrossmintConfigStatus() {
  const { isConfigured, environment, developmentMode } = useCrossmint()
  
  if (process.env.NODE_ENV !== 'development') {
    return null
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-xs z-50">
      <div className="font-semibold text-gray-900 mb-2">Crossmint Status</div>
      <div className="space-y-1 text-gray-600">
        <div className="flex justify-between">
          <span>Environment:</span>
          <span className="font-medium">{environment}</span>
        </div>
        <div className="flex justify-between">
          <span>Configured:</span>
          <span className={`font-medium ${isConfigured ? 'text-green-600' : 'text-red-600'}`}>
            {isConfigured ? 'Yes' : 'No'}
          </span>
        </div>
        {developmentMode && (
          <div className="flex justify-between">
            <span>Mode:</span>
            <span className="font-medium text-blue-600">Development</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default CrossmintProvider