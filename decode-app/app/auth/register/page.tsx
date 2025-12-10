'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AITextLoading from '@/components/ui/AITextLoading'

export default function AuthRegisterPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to auth page in register mode
    router.replace('/auth?mode=register')
  }, [router])

  return (
    <div className="cosmic-bg-model min-h-screen flex items-center justify-center px-4">
      <div className="rounded-xl overflow-hidden shadow-lg">
        <AITextLoading />
      </div>
    </div>
  )
}