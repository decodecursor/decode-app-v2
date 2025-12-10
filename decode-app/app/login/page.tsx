'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AITextLoading from '@/components/ui/AITextLoading'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to auth page in login mode
    router.replace('/auth?mode=login')
  }, [router])

  return (
    <div className="cosmic-bg-model min-h-screen flex items-center justify-center px-4">
      <div className="rounded-xl overflow-hidden shadow-lg">
        <AITextLoading />
      </div>
    </div>
  )
}