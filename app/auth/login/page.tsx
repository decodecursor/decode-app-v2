'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthLoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to auth page in login mode
    router.replace('/auth?mode=login')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="mt-4 text-gray-300">Redirecting to login...</p>
      </div>
    </div>
  )
}