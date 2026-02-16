'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUserWithProxy } from '@/utils/auth-helper'
import { createClient } from '@/utils/supabase/client'

interface UserProfile {
  email: string
  user_name: string | null
  phone_number: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { user } = await getUserWithProxy()
      if (!user) {
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { data } = await supabase
        .from('users')
        .select('email, user_name, phone_number')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="text-white/40 text-sm">Loading...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="text-white/40 text-sm">Not signed in.</div>
      </div>
    )
  }

  const displayName = profile.user_name || profile.email.split('@')[0]

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Link
        href="/offers"
        className="text-[13px] text-white/40 hover:text-white/60 transition-colors inline-flex items-center gap-1 mb-6"
      >
        ← Back to offers
      </Link>

      <h1 className="text-xl font-semibold text-white mb-6">Profile</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-[12px] text-white/40 uppercase tracking-wide mb-1">Email</label>
          <div className="text-[14px] text-white/80">{profile.email}</div>
        </div>

        <div>
          <label className="block text-[12px] text-white/40 uppercase tracking-wide mb-1">Name</label>
          <div className="text-[14px] text-white/80">{displayName}</div>
        </div>

        {profile.phone_number && (
          <div>
            <label className="block text-[12px] text-white/40 uppercase tracking-wide mb-1">Phone</label>
            <div className="text-[14px] text-white/80">{profile.phone_number}</div>
          </div>
        )}
      </div>
    </div>
  )
}
