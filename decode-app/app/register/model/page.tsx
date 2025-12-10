'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterModelPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to auth page with pre-selected model role
    router.replace('/auth?role=model&mode=register')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="mt-4 text-gray-300">Redirecting to Model registration...</p>
      </div>
    </div>
  )
}