'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AuthLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const redirectTo = searchParams?.get('redirectTo')
    router.replace(`/auth?mode=login${redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : ''}`)
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        <p className="mt-4 text-gray-300">Redirecting to login...</p>
      </div>
    </div>
  )
}

export default function AuthLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Redirecting to login...</p>
        </div>
      </div>
    }>
      <AuthLoginContent />
    </Suspense>
  )
}
