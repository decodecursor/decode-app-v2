'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import RoleSelectionModal from '@/components/RoleSelectionModal'
import PasswordInput from '@/components/PasswordInput'

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [signedUpUser, setSignedUpUser] = useState<any>(null)
  const [agreedToTerms, setAgreedToTerms] = useState(true)
  const [emailError, setEmailError] = useState('')
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [inviteData, setInviteData] = useState<any>(null)
  const supabase = createClient()
  
  // Auto-hide error messages after 5 seconds
  useEffect(() => {
    if (message && (message.includes('error') || message.includes('Error') || message.includes('Invalid'))) {
      const timer = setTimeout(() => {
        setMessage('')
      }, 5000)
      
      return () => clearTimeout(timer)
    }
    return undefined
  }, [message])

  // Handle invite parameter from URL
  useEffect(() => {
    const inviteParam = searchParams?.get('invite')
    if (inviteParam) {
      try {
        const decodedData = JSON.parse(Buffer.from(inviteParam, 'base64').toString())
        setInviteData(decodedData)
        setEmail(decodedData.email || '')
        setIsLogin(false) // Force signup mode for invitations
        setMessage(`Welcome! You've been invited to join ${decodedData.companyName}`)
      } catch (error) {
        console.error('Invalid invite link:', error)
        setMessage('Invalid invitation link')
      }
    }
  }, [searchParams])

  // Check for authenticated user on page load (handles email verification returns)
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        const justVerified = searchParams?.get('verified') === 'true'
        
        if (user && (user.email_confirmed_at || justVerified)) {
          console.log('✅ [AUTH] Found verified user on page load:', user.id, { justVerified })
          
          // Quick check if user already has a profile
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single()
          
          if (profileError && profileError.code === 'PGRST116') {
            // User doesn't have profile yet - show role modal to complete registration
            console.log('✅ [AUTH] Verified user needs to complete profile')
            setEmail(user.email || '')
            setSignedUpUser(user)
            setShowRoleModal(true)
            setMessage('Please complete your profile to finish registration')
          } else if (profileData) {
            // User already has profile - redirect to dashboard
            console.log('✅ [AUTH] User already has profile - redirecting to dashboard')
            router.push('/dashboard')
          }
        } else if (justVerified) {
          // User has verified=true parameter but no authenticated user yet
          // This can happen if session setting failed - try to recover
          console.log('⚠️ [AUTH] Verification parameter present but no user session - waiting for session')
          setTimeout(() => {
            // Retry after a delay to allow session to be established
            checkAuthState()
          }, 1000)
        }
      } catch (error) {
        // Silently continue - don't block normal auth flow
        console.warn('Auth state check error:', error)
      }
    }
    
    checkAuthState()
  }, [searchParams, router, supabase])

  // Real-time email validation
  useEffect(() => {
    const checkEmailExists = async () => {
      if (!isLogin && email && email.includes('@')) {
        setCheckingEmail(true)
        try {
          const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            credentials: 'include',
            // Add timeout and better error handling
            signal: AbortSignal.timeout(5000), // 5 second timeout
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.exists) {
              setEmailError('This email is already registered')
            } else {
              setEmailError('')
            }
          } else if (response.status === 429) {
            // Rate limited - skip validation
            setEmailError('')
          } else {
            // Don't show error for network issues, just skip validation
            console.warn('Email check failed with status:', response.status)
            setEmailError('')
          }
        } catch (error: any) {
          // Network error - don't block user, just skip validation
          if (error.name === 'TimeoutError') {
            console.warn('Email check timeout - proceeding without validation')
          } else if (error.name === 'AbortError') {
            console.warn('Email check aborted - proceeding without validation')
          } else {
            console.warn('Email check error:', error.message)
          }
          setEmailError('')
        } finally {
          setCheckingEmail(false)
        }
      } else {
        setEmailError('')
      }
    }

    const debounceTimer = setTimeout(checkEmailExists, 500)
    return () => clearTimeout(debounceTimer)
  }, [email, isLogin])

  // Retry mechanism for network failures
  const retryWithDelay = async (fn: () => Promise<any>, maxRetries = 2, delay = 1000): Promise<any> => {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn()
      } catch (error: any) {
        const isNetworkError = error.message?.includes('fetch') || 
                               error.name === 'NetworkError' || 
                               error.message?.includes('Failed to fetch') ||
                               error.code === 'NETWORK_ERROR'
        
        if (i === maxRetries || !isNetworkError) {
          throw error
        }
        
        console.log(`🔄 Retry attempt ${i + 1}/${maxRetries} after ${delay}ms delay`)
        setIsRetrying(true)
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 1.5 // Exponential backoff
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    // Validate terms acceptance for signup
    if (!isLogin && !agreedToTerms) {
      setMessage('Please agree to the Terms of Service and Privacy Policy')
      setLoading(false)
      return
    }
    
    // Check for email error
    if (!isLogin && emailError) {
      setMessage(emailError)
      setLoading(false)
      return
    }
    
    try {
      setIsRetrying(false)
      
      // Execute auth flow directly without retry wrapper
      if (isLogin) {
          console.log('🔐 Attempting login for:', email)
          
          // Try direct Supabase login first
          let loginSuccess = false
          let loginData: any = null
          let loginError: any = null
          
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password
            })
            
            if (!error && data.user && data.session) {
              loginSuccess = true
              loginData = data
            } else {
              loginError = error || new Error('Login failed')
            }
          } catch (error: any) {
            console.log('Direct login failed, trying proxy...', error.message)
            loginError = error
          }
          
          // If direct login failed, try proxy
          if (!loginSuccess) {
            console.log('🔄 Using proxy for login due to connection issues')
            try {
              const proxyResponse = await fetch('/api/auth/proxy-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
              })
              
              const proxyData = await proxyResponse.json()
              
              if (proxyResponse.ok && proxyData.success) {
                console.log('✅ Proxy login successful')
                // Set the session manually
                if (proxyData.session) {
                  await supabase.auth.setSession({
                    access_token: proxyData.session.access_token,
                    refresh_token: proxyData.session.refresh_token
                  })
                }
                loginSuccess = true
                loginData = proxyData
              } else {
                throw new Error(proxyData.error || 'Proxy login failed')
              }
            } catch (proxyError: any) {
              console.error('Both direct and proxy login failed')
              throw loginError || proxyError
            }
          }
          
          if (loginSuccess && loginData) {
            console.log('✅ User logged in successfully')
            
            // Wait for session to be properly stored before redirect
            await new Promise(resolve => setTimeout(resolve, 200))
            
            // Verify session is accessible with retry logic
            let sessionVerified = false
            for (let i = 0; i < 3; i++) {
              const { data: sessionCheck } = await supabase.auth.getSession()
              if (sessionCheck.session) {
                console.log('✅ Session verified, redirecting to dashboard')
                sessionVerified = true
                break
              }
              if (i < 2) {
                console.log(`⏳ Session not found yet, retrying... (${i + 1}/3)`)
                await new Promise(resolve => setTimeout(resolve, 300))
              }
            }
            
            if (sessionVerified) {
              router.push('/dashboard')
            } else {
              console.error('❌ Session not found after multiple attempts')
              throw new Error('Session was not properly established after multiple attempts')
            }
            return loginData
          } else {
            throw new Error('Login failed - no user or session data returned')
          }
        } else {
          console.log('📝 [AUTH] Attempting signup for:', email)
          console.log('📝 [AUTH] Has invite data:', !!inviteData)
          
          // Try direct Supabase signup first
          let signupSuccess = false
          let signupData: any = null
          let signupError: any = null
          
          try {
            const { data, error } = await Promise.race([
              supabase.auth.signUp({
                email,
                password
              }),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Signup timeout after 10 seconds')), 10000)
              )
            ])
            
            console.log('📝 [AUTH] Direct signup response data:', data)
            console.log('📝 [AUTH] Direct signup response error:', error)
            
            if (!error && data) {
              signupSuccess = true
              signupData = data
            } else {
              signupError = error || new Error('Signup failed')
            }
          } catch (error: any) {
            console.log('Direct signup failed, trying proxy...', error.message)
            signupError = error
          }
          
          // If direct signup failed, try proxy
          if (!signupSuccess) {
            console.log('🔄 Using proxy for signup due to connection issues')
            try {
              const proxyResponse = await fetch('/api/auth/proxy-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
              })
              
              const proxyData = await proxyResponse.json()
              
              if (proxyResponse.ok && proxyData.success) {
                console.log('✅ Proxy signup successful')
                signupSuccess = true
                signupData = proxyData
              } else {
                throw new Error(proxyData.error || 'Proxy signup failed')
              }
            } catch (proxyError: any) {
              console.error('Both direct and proxy signup failed')
              throw signupError || proxyError
            }
          }
          
          if (!signupSuccess || !signupData) {
            console.error('❌ [AUTH] Signup failed - no data returned')
            throw signupError || new Error('Signup failed - no data returned')
          }
          
          if (signupData.user) {
            console.log('✅ [AUTH] User signed up successfully:', signupData.user.id)
            console.log('✅ [AUTH] User confirmed status:', signupData.user.email_confirmed_at ? 'CONFIRMED' : 'NOT CONFIRMED')
            console.log('✅ [AUTH] Session created:', !!signupData.session)
            console.log('✅ [AUTH] Is invited user:', !!inviteData)
            
            // For invited users, skip email verification and go straight to role modal
            if (inviteData) {
              console.log('✅ [AUTH] Invited user - skipping email verification')
              setSignedUpUser(signupData.user)
              setShowRoleModal(true)
              return signupData
            }
            
            // For regular users, check if email is confirmed
            if (signupData.user.email_confirmed_at || signupData.session) {
              console.log('✅ [AUTH] Email confirmed or session active - showing role modal')
              setSignedUpUser(signupData.user)
              setShowRoleModal(true)
              return signupData
            } else {
              console.log('📧 [AUTH] Email confirmation required for regular user')
              router.push(`/verify-email?email=${encodeURIComponent(email)}`)
              return signupData
            }
          } else {
            // No user object means email confirmation required
            console.log('📧 [AUTH] No user object - email confirmation required')
            router.push(`/verify-email?email=${encodeURIComponent(email)}`)
            return signupData
        }
      }
    } catch (error: any) {
      console.error('💥 Authentication error:', error)
      console.error('💥 Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        supabaseError: error.supabaseError || 'none'
      })
      
      // Handle specific error types with more detailed logging
      if (error.message?.includes('Invalid login credentials')) {
        console.log('🔐 Login failed: Invalid credentials')
        setMessage('Invalid email or password. Please check and try again.')
      } else if (error.message?.includes('Email not confirmed')) {
        console.log('📧 Login failed: Email not confirmed')
        setMessage('Please check your email and click the verification link.')
      } else if (error.message?.includes('Session was not properly established')) {
        console.log('🎫 Login failed: Session establishment issue')
        setMessage('Login session failed to establish. Please try again.')
      } else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        console.log('⏰ Authentication failed: Timeout error')
        setMessage('Request timed out. Please check your connection and try again.')
      } else if (error.message?.includes('network') || error.name === 'NetworkError') {
        console.log('🌐 Authentication failed: Network error')
        setMessage('Connection error. Please check your internet and try again.')
      } else if (error.message?.includes('fetch')) {
        console.log('🌐 Authentication failed: Fetch error')
        setMessage('Network error. Please try again in a moment.')
      } else if (error.message?.includes('Database operation timeout')) {
        console.log('🗄️ Authentication failed: Database timeout')
        setMessage('Registration is taking longer than expected. Please try again.')
      } else {
        console.log('❓ Authentication failed: Unknown error -', error.message)
        setMessage(error.message || 'An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
      setIsRetrying(false)
    }
  }

  const handleRoleModalClose = () => {
    setShowRoleModal(false)
    // Redirect to verification page even if user closes modal
    router.push(`/verify-email?email=${encodeURIComponent(email)}`)
  }

  const handleRoleModalComplete = () => {
    setShowRoleModal(false)
    // Redirect to email verification page
    router.push(`/verify-email?email=${encodeURIComponent(email)}`)
  }

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="cosmic-card-login">
          <div className="text-center mb-16">
            <img src="/logo.png" alt="DECODE" className="mx-auto mb-2" style={{height: '40px', filter: 'brightness(0) invert(1)'}} />
            <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`cosmic-input ${!isLogin && emailError ? 'border-red-500' : ''}`}
                required
                disabled={loading}
              />
              {!isLogin && checkingEmail && (
                <div className="absolute -bottom-5 left-0 text-xs text-gray-400">
                  Checking email...
                </div>
              )}
              {!isLogin && emailError && (
                <div className="absolute -bottom-5 left-0 text-xs text-red-400">
                  {emailError}
                </div>
              )}
            </div>
            <div>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Password"
                required
                disabled={loading}
                showValidation={!isLogin}
              />
            </div>
            
            {!isLogin && (
              <div className="flex items-center justify-center space-x-3">
                <input
                  type="checkbox"
                  id="auth-terms-agreement"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 terms-checkbox"
                  disabled={loading}
                />
                <label htmlFor="auth-terms-agreement" className="text-xs text-gray-300 leading-relaxed text-center">
                  I agree to the{' '}
                  <a href="https://welovedecode.com/#terms" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline hover:text-purple-300 transition-colors">
                    Terms of Service
                  </a>
                  {' '}and{' '}
                  <a href="https://welovedecode.com/#privacy" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline hover:text-purple-300 transition-colors">
                    Privacy Policy
                  </a>
                </label>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="cosmic-button-primary w-full"
            >
              {loading ? (isRetrying ? 'Retrying...' : 'Loading...') : (isLogin ? 'Login' : 'Register')}
            </button>
            
            {message && (
              <div className={`text-center p-3 rounded-lg text-sm ${
                message.includes('error') || message.includes('Error') 
                  ? 'text-red-300 bg-red-900/20' 
                  : 'text-green-300 bg-green-900/20'
              }`}>
                {message}
              </div>
            )}
            
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="cosmic-button-secondary"
              >
                {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <RoleSelectionModal
        isOpen={showRoleModal}
        userEmail={email}
        userId={signedUpUser?.id}  // Pass the user ID directly
        termsAcceptedAt={new Date().toISOString()}
        inviteData={inviteData}  // Pass invite data for pre-population
        onClose={handleRoleModalClose}
        onComplete={handleRoleModalComplete}
      />
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card-login">
            <div className="text-center mb-16">
              <img src="/logo.png" alt="DECODE" className="mx-auto mb-2" style={{height: '40px', filter: 'brightness(0) invert(1)'}} />
              <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
            </div>
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  )
}