'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface EmailVerificationGateProps {
  children: React.ReactNode
  userId?: string
  userEmail?: string
  onVerificationStatusChange?: (isVerified: boolean) => void
}

export function EmailVerificationGate({
  children,
  userId,
  userEmail,
  onVerificationStatusChange
}: EmailVerificationGateProps) {
  const [isVerified, setIsVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    checkVerificationStatus()
  }, [userId])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const checkVerificationStatus = async () => {
    try {
      setLoading(true)
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        console.error('Error checking verification status:', error)
        setIsVerified(false)
        setLoading(false)
        return
      }

      const verified = !!user.email_confirmed_at
      setIsVerified(verified)
      onVerificationStatusChange?.(verified)

      console.log('🔍 [EMAIL-GATE] Verification status:', {
        userId: user.id,
        email: user.email,
        confirmed_at: user.email_confirmed_at,
        isVerified: verified
      })
    } catch (error) {
      console.error('Error checking verification status:', error)
      setIsVerified(false)
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!userEmail || resendCooldown > 0) return

    setResendLoading(true)
    setResendMessage('')

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail
      })

      if (error) {
        console.error('Resend verification error:', error)
        setResendMessage(`Error: ${error.message}`)
      } else {
        setResendMessage('Verification email sent! Please check your inbox.')
        setResendCooldown(60) // 60 second cooldown
      }
    } catch (error) {
      console.error('Resend verification exception:', error)
      setResendMessage('Failed to send verification email. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleChangeEmail = () => {
    // Redirect to profile page where user can change email
    window.location.href = '/profile'
  }

  if (loading) {
    return (
      <div className="cosmic-bg-model min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="cosmic-card text-center">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto mb-4" />
              <div className="h-4 w-48 bg-gray-700 rounded mx-auto mb-2" />
              <div className="h-4 w-32 bg-gray-700 rounded mx-auto" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isVerified) {
    return (
      <div className="cosmic-bg-model min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="cosmic-card text-center">
            <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <h1 className="cosmic-heading text-white mb-4">
              Verify Your Email
            </h1>

            <p className="cosmic-body text-white/70 mb-6">
              Please verify your email address to access all features of your dashboard.
            </p>

            {userEmail && (
              <div className="bg-white/5 border border-gray-700 rounded-lg p-4 mb-6">
                <p className="text-white font-medium mb-2">Verification email sent to:</p>
                <p className="text-purple-400 font-mono text-sm break-all">{userEmail}</p>
              </div>
            )}

            <div className="space-y-4 mb-8">
              <p className="text-white/60 text-sm">
                Check your inbox (and spam folder) for a verification link.
              </p>

              {resendMessage && (
                <div className={`p-3 rounded-lg ${
                  resendMessage.includes('Error')
                    ? 'bg-red-600/20 border border-red-500/30 text-red-100'
                    : 'bg-green-600/20 border border-green-500/30 text-green-100'
                }`}>
                  <p className="text-sm">{resendMessage}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <button
                onClick={handleResendVerification}
                disabled={resendLoading || resendCooldown > 0}
                className="cosmic-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendLoading ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Email'}
              </button>

              <button
                onClick={checkVerificationStatus}
                className="cosmic-button-secondary"
              >
                I've Verified
              </button>
            </div>

            <div className="border-t border-gray-700 pt-6">
              <p className="text-white/60 text-sm mb-4">
                Wrong email address?
              </p>
              <button
                onClick={handleChangeEmail}
                className="text-purple-400 hover:text-purple-300 text-sm underline"
              >
                Update your email in profile settings
              </button>
            </div>

            {/* Dashboard Preview Section */}
            <div className="mt-12 p-6 bg-white/5 border border-gray-700 rounded-lg">
              <h3 className="text-white font-medium mb-4">What you'll get access to:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center space-x-2 text-gray-300">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Create Payment Links</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-300">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Manage Payouts</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-300">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Full Dashboard Access</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Email is verified, show the dashboard
  return <>{children}</>
}