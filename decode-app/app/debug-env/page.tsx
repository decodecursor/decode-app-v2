'use client'

// DEBUG PAGE - Remove this file after debugging
export default function DebugEnv() {
  return (
    <div className="p-8 bg-black text-white">
      <h1 className="text-2xl mb-4">Environment Debug</h1>
      <div className="space-y-2">
        <p><strong>NEXT_PUBLIC_APP_URL:</strong> {process.env.NEXT_PUBLIC_APP_URL || 'undefined'}</p>
        <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV || 'undefined'}</p>
        <p><strong>window.location.origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'N/A (SSR)'}</p>
        <p><strong>window.location.href:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A (SSR)'}</p>
        
        <h2 className="text-xl mt-6 mb-2">All NEXT_PUBLIC_ Variables:</h2>
        <pre className="bg-gray-800 p-4 rounded">
          {JSON.stringify(
            Object.fromEntries(
              Object.entries(process.env).filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
            ),
            null,
            2
          )}
        </pre>
      </div>
    </div>
  )
}