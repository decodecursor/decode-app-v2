'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
import { EmailVerificationGate } from '@/components/EmailVerificationGate'

export default function PendingApproval() {
  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const getUserInfo = async () => {
      const { user } = await getUserWithProxy()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUser(user)
      const supabase = createClient()

      const { data: userData } = await supabase
        .from('users')
        .select('user_name, company_name, approval_status')
        .eq('id', user.id)
        .single()

      if (userData) {
        if (userData.approval_status === 'approved') {
          window.location.href = '/dashboard'
          return
        }
        setUserName(userData.user_name)
        setCompanyName(userData.company_name)
      }
    }

    getUserInfo()
  }, [])

  const handleSignOut = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/auth'
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <EmailVerificationGate
      userId={user?.id}
      userEmail={user?.email}
    >
      <div className="cosmic-bg-model min-h-screen">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="cosmic-card-login max-w-md">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="DECODE" className="mx-auto mb-4" style={{height: '40px', filter: 'brightness(0) invert(1)'}} />
            <h1 className="text-2xl font-semibold text-white mb-4">Approval Pending</h1>
          </div>

          <div className="text-center space-y-4">
            <div className="p-6 bg-yellow-900/20 rounded-lg border border-yellow-600/30">
              <div className="text-yellow-400 text-lg font-medium mb-2">
                👋 Hello {userName}
              </div>
              <div className="text-gray-300 text-sm leading-relaxed">
                Your registration is pending your company admin's approval.
              </div>
            </div>

            <div className="text-gray-400 text-sm">
              You will receive access once your admin approves your account. Please contact your administrator.
            </div>

            <button
              onClick={handleSignOut}
              className="cosmic-button-secondary w-full mt-6"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      </div>
    </EmailVerificationGate>
  )
}