'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const handleVerification = async () => {
      try {
        const token = searchParams?.get('token')
        const type = searchParams?.get('type')

        if (!token) {
          setMessage('Invalid verification link - no token provided')
          setLoading(false)
          return
        }

        console.log('🔍 Processing verification:', { token: token?.substring(0, 20) + '...', type })

        const supabase = createClient()

        // For signup verification, use verifyOtp
        if (type === 'signup') {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          })

          console.log('📝 Verification result:', { data: !!data, error })

          if (error) {
            console.error('❌ Verification error:', error)
            
            // Handle specific error cases
            if (error.message?.includes('expired')) {
              setMessage('Verification link has expired. Please request a new one.')
            } else if (error.message?.includes('invalid')) {
              setMessage('Invalid verification link. Please try registering again.')
            } else {
              setMessage(`Verification failed: ${error.message}`)
            }
            setLoading(false)
            return
          }

          if (data.user) {
            console.log('✅ Email verified successfully for user:', data.user.id)
            setEmail(data.user.email || '')
            setSuccess(true)
            setMessage('Email verified successfully! Redirecting to complete your profile...')
            
            // Wait a moment then redirect to auth page to complete registration
            setTimeout(() => {
              router.push('/auth')
            }, 2000)
          } else {
            setMessage('Verification completed but no user data returned. Please try logging in.')
          }
        } else {
          setMessage('Unsupported verification type')
        }

      } catch (error: any) {
        console.error('💥 Verification error:', error)
        
        // Handle network errors (VPN issues)
        if (error.message?.includes('network') || error.name === 'NetworkError') {
          setMessage('Connection error during verification. Please check your network and try again.')
        } else {
          setMessage(`Verification failed: ${error.message || 'Unknown error'}`)
        }
      } finally {
        setLoading(false)
      }
    }

    handleVerification()
  }, [searchParams, router])

  const handleResendVerification = async () => {
    if (!email) {
      setMessage('Cannot resend - email not available. Please try registering again.')
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
      setMessage('New verification email sent! Please check your inbox.')
    } catch (error: any) {
      setMessage(`Failed to resend email: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cosmic-bg">
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
              {loading ? (
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <svg className="animate-spin h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : success ? (
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              
              <h2 className="text-lg font-medium text-white mb-3">
                {loading ? 'Verifying Email...' : success ? 'Email Verified!' : 'Verification Failed'}
              </h2>
              
              {message && (
                <p className="text-sm text-gray-300 mb-6">
                  {message}
                </p>
              )}
            </div>

            {!loading && !success && (
              <div className="space-y-3">
                {email && (
                  <button
                    onClick={handleResendVerification}
                    disabled={loading}
                    className="cosmic-button-primary w-full"
                  >
                    Resend Verification Email
                  </button>
                )}

                <div className="text-center">
                  <a 
                    href="/auth" 
                    className="cosmic-button-secondary inline-block"
                  >
                    Back to Login
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="cosmic-card-login">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 mx-auto text-purple-400">⏳</div>
              <p className="text-white mt-4">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}