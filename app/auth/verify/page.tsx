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

        // For signup verification, use verifyOtp
        if (type === 'signup') {
          const supabase = createClient()

          // Try direct Supabase verification first
          let verificationSuccess = false
          let verificationData: any = null
          let verificationError: any = null

          try {
            console.log('📝 Attempting direct verification...')
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: 'signup'
            })

            console.log('📝 Direct verification result:', { data: !!data, error })

            if (!error && data) {
              verificationSuccess = true
              verificationData = data
            } else {
              verificationError = error || new Error('Verification failed')
            }
          } catch (error: any) {
            console.log('Direct verification failed, trying proxy...', error.message)
            verificationError = error
          }

          // If direct verification failed, try proxy
          if (!verificationSuccess) {
            console.log('🔄 Using proxy for verification due to connection issues')
            try {
              const proxyResponse = await fetch('/api/auth/proxy-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, type })
              })

              const proxyData = await proxyResponse.json()

              if (proxyResponse.ok && proxyData.success) {
                console.log('✅ Proxy verification successful')
                verificationSuccess = true
                verificationData = proxyData
              } else {
                throw new Error(proxyData.error || 'Proxy verification failed')
              }
            } catch (proxyError: any) {
              console.error('Both direct and proxy verification failed')
              verificationError = verificationError || proxyError
            }
          }

          // Handle verification result
          if (verificationSuccess && verificationData) {
            if (verificationData.user) {
              console.log('✅ Email verified successfully for user:', verificationData.user.id)
              setEmail(verificationData.user.email || '')
              setSuccess(true)
              setMessage('Email verified successfully! Checking your profile...')
              
              // If we have session data from proxy verification, set it explicitly
              if (verificationData.session) {
                console.log('🔄 Setting session from proxy verification...')
                try {
                  const { error: sessionError } = await supabase.auth.setSession({
                    access_token: verificationData.session.access_token,
                    refresh_token: verificationData.session.refresh_token
                  })
                  if (sessionError) {
                    console.warn('⚠️ Session error:', sessionError)
                  } else {
                    console.log('✅ Session set successfully')
                    // Wait a moment for session to be fully established
                    await new Promise(resolve => setTimeout(resolve, 500))
                  }
                } catch (sessionError) {
                  console.warn('⚠️ Failed to set session, but verification succeeded:', sessionError)
                }
              }
              
              // Check if user has completed their profile to determine redirect destination
              try {
                console.log('🔍 Checking user profile status...')
                
                // Add timeout to profile check to avoid hanging due to VPN issues
                const profileCheckPromise = supabase
                  .from('users')
                  .select('id, role, company_name, approval_status')
                  .eq('id', verificationData.user.id)
                  .single()
                
                const timeoutPromise = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Profile check timeout - assuming new user')), 5000)
                )
                
                const { data: userProfile, error: profileError } = await Promise.race([
                  profileCheckPromise,
                  timeoutPromise
                ])

                if (profileError && profileError.code !== 'PGRST116') {
                  // Handle timeout as "no profile found" since new users won't have profiles anyway
                  if (profileError.message?.includes('timeout') || profileError.message?.includes('Profile check timeout')) {
                    console.log('⏰ Profile check timed out - assuming new user needs profile')
                    // Treat as no profile found, continue to role selection
                  } else {
                    console.error('Error checking profile:', profileError)
                    setMessage('Verification successful! Please complete your profile.')
                    setTimeout(() => {
                      router.push('/auth?verified=true')
                    }, 2000)
                    return
                  }
                }

                if (!userProfile) {
                  // No profile exists - user needs to complete role selection
                  console.log('📝 No profile found - redirecting to role selection')
                  setMessage('Email verified! Please complete your profile.')
                  setTimeout(() => {
                    router.push('/auth?verified=true')
                  }, 2000)
                } else {
                  // Profile exists - check approval status and redirect accordingly
                  console.log('👤 Profile found:', { role: userProfile.role, status: userProfile.approval_status })
                  
                  if (userProfile.approval_status === 'pending' && userProfile.role !== 'Admin') {
                    setMessage('Email verified! Please wait for admin approval.')
                    setTimeout(() => {
                      router.push('/pending-approval')
                    }, 2000)
                  } else {
                    // User is approved or is admin - go directly to dashboard
                    setMessage('Email verified! Welcome back!')
                    setTimeout(() => {
                      router.push('/dashboard')
                    }, 2000)
                  }
                }
              } catch (profileCheckError: any) {
                console.error('Profile check failed:', profileCheckError)
                
                // Handle timeout as "no profile found" since new users won't have profiles anyway
                if (profileCheckError.message?.includes('timeout') || profileCheckError.message?.includes('Profile check timeout')) {
                  console.log('⏰ Profile check timed out - assuming new user needs profile')
                  setMessage('Email verified! Please complete your profile.')
                  setTimeout(() => {
                    router.push('/auth?verified=true')
                  }, 2000)
                } else {
                  setMessage('Verification successful! Please complete your profile.')
                  setTimeout(() => {
                    router.push('/auth?verified=true')
                  }, 2000)
                }
              }
            } else {
              setMessage('Verification completed but no user data returned. Please try logging in.')
            }
          } else {
            console.error('❌ Verification error:', verificationError)
            
            // Handle specific error cases
            if (verificationError.message?.includes('expired')) {
              setMessage('Verification link has expired. Please request a new one.')
            } else if (verificationError.message?.includes('invalid')) {
              setMessage('Invalid verification link. Please try registering again.')
            } else if (verificationError.message?.includes('network') || verificationError.name === 'NetworkError') {
              setMessage('Connection error during verification. Please check your network and try again.')
            } else {
              setMessage(`Verification failed: ${verificationError.message}`)
            }
            setLoading(false)
            return
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