'use client'

import { useEffect, useState } from 'react'

export default function DebugClientEnvPage() {
  const [envData, setEnvData] = useState<any>(null)
  const [clientEnvData, setClientEnvData] = useState<any>(null)

  useEffect(() => {
    // Check what environment variables are available in the browser
    const browserEnvCheck = {
      // These should be available in the browser
      NEXT_PUBLIC_CROSSMINT_PROJECT_ID: process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID,
      NEXT_PUBLIC_CROSSMINT_API_KEY: process.env.NEXT_PUBLIC_CROSSMINT_API_KEY ? 'SET' : 'MISSING',
      NEXT_PUBLIC_CROSSMINT_WEBHOOK_SECRET: process.env.NEXT_PUBLIC_CROSSMINT_WEBHOOK_SECRET ? 'SET' : 'MISSING',
      NEXT_PUBLIC_DECODE_WALLET_ADDRESS: process.env.NEXT_PUBLIC_DECODE_WALLET_ADDRESS,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NODE_ENV: process.env.NODE_ENV,
      
      // These should NOT be available in the browser (server-side only)
      CROSSMINT_API_KEY: process.env.CROSSMINT_API_KEY ? 'EXPOSED (BAD)' : 'HIDDEN (GOOD)',
      CROSSMINT_WEBHOOK_SECRET: process.env.CROSSMINT_WEBHOOK_SECRET ? 'EXPOSED (BAD)' : 'HIDDEN (GOOD)',
      DECODE_WALLET_ADDRESS: process.env.DECODE_WALLET_ADDRESS ? 'EXPOSED (BAD)' : 'HIDDEN (GOOD)',
    }

    setClientEnvData(browserEnvCheck)

    // Also fetch from our API endpoint
    fetch('/api/debug/client-env')
      .then(res => res.json())
      .then(data => setEnvData(data))
      .catch(err => setEnvData({ error: err.message }))
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Debug Client Environment Variables</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Browser Environment Check */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">🌐 Browser Environment (Direct)</h2>
            <pre className="bg-gray-700 p-4 rounded text-sm overflow-x-auto">
              {JSON.stringify(clientEnvData, null, 2)}
            </pre>
          </div>

          {/* API Environment Check */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">🔧 API Environment (Server)</h2>
            <pre className="bg-gray-700 p-4 rounded text-sm overflow-x-auto">
              {JSON.stringify(envData, null, 2)}
            </pre>
          </div>
        </div>

        <div className="mt-8 bg-yellow-900 border border-yellow-600 p-4 rounded-lg">
          <h3 className="text-yellow-200 font-semibold mb-2">🔍 What to Look For:</h3>
          <ul className="text-yellow-100 text-sm space-y-1">
            <li>• <strong>NEXT_PUBLIC_CROSSMINT_PROJECT_ID</strong> should show the Project ID</li>
            <li>• <strong>NEXT_PUBLIC_CROSSMINT_API_KEY</strong> should show "SET"</li>
            <li>• <strong>NEXT_PUBLIC_CROSSMINT_WEBHOOK_SECRET</strong> should show "SET"</li>
            <li>• <strong>NEXT_PUBLIC_DECODE_WALLET_ADDRESS</strong> should show the wallet address</li>
            <li>• Server-side variables should show "HIDDEN (GOOD)" in browser</li>
          </ul>
        </div>

        <div className="mt-4">
          <a 
            href="/api/debug/test-crossmint" 
            target="_blank"
            className="inline-block bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
          >
            🧪 Test Crossmint API
          </a>
        </div>
      </div>
    </div>
  )
}