'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function PaymentPage() {
  const [mounted, setMounted] = useState(false)
  const params = useParams()
  const router = useRouter()
  const linkId = params.linkId as string

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null // Prevent SSR hydration issues
  }

  console.log('🔍 PaymentPage rendering with linkId:', linkId)

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Payment Page</h1>
        <p className="text-gray-600 mb-2">Link ID: {linkId}</p>
        <p className="text-gray-500 text-sm">Component mounted: {mounted ? 'Yes' : 'No'}</p>
        <div className="mt-4">
          <button 
            onClick={() => console.log('Button clicked!')}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Test Button
          </button>
        </div>
      </div>
    </div>
  )
}