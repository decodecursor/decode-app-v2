'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function VerifyEmailPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const resendVerificationEmail = async () => {
    const email = new URLSearchParams(window.location.search).get('email')
    if (!email) {
      setMessage('Email not provided. Please try registering again.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      })

      if (error) throw error
      setMessage('Verification email sent! Please check your inbox.')
    } catch (error) {
      setMessage((error as Error).message || 'Failed to resend email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cosmic-bg-model">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="cosmic-card-login">
          <div className="text-center mb-8">
            <img 
              src="/logo.png" 
              alt="DECODE" 
              className="mx-auto mb-4" 
              style={{height: '40px', filter: 'brightness(0) invert(1)'}} 
            />
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              
              <h2 className="text-lg font-medium text-white mb-3">
                Verification Email Sent
              </h2>
              
              <p className="text-sm text-gray-300 mb-6">
                Click the verification link in your email to activate your account and complete registration.
              </p>

            </div>

            {message && (
              <div className={`text-center p-3 rounded-lg text-sm ${
                message.includes('sent') || message.includes('Sent')
                  ? 'text-green-300 bg-green-900/20' 
                  : 'text-red-300 bg-red-900/20'
              }`}>
                {message}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={resendVerificationEmail}
                disabled={loading}
                className="cosmic-button-primary w-full"
              >
                {loading ? 'Sending...' : 'Resend Verification Email'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}