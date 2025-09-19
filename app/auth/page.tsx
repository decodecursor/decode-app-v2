'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
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
  const [tempPassword, setTempPassword] = useState<string>('')
  const [agreedToTerms, setAgreedToTerms] = useState(true)
  const [emailError, setEmailError] = useState('')
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [inviteData, setInviteData] = useState<any>(null)
  const [fallbackTriggered, setFallbackTriggered] = useState(false)
  const [isPostVerificationFlow, setIsPostVerificationFlow] = useState(false)
  const [preselectedRole, setPreselectedRole] = useState<string | null>(null)
  const supabase = createClient()
  
  // Add submission guard to prevent concurrent submissions
  const isSubmitting = useRef(false)
  const lastSubmissionTime = useRef(0)
  
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

  // Handle invite parameter and pre-selected role from URL
  useEffect(() => {
    const inviteParam = searchParams?.get('invite')
    const roleParam = searchParams?.get('role')
    const modeParam = searchParams?.get('mode')

    // Handle mode parameter for login/register
    if (modeParam === 'login') {
      setIsLogin(true)
    } else if (modeParam === 'register') {
      setIsLogin(false)
    }

    // Handle pre-selected role for direct registration links
    if (roleParam && modeParam === 'register') {
      // Map URL roles to database roles
      const roleMapping: { [key: string]: string } = {
        'admin': 'Admin',
        'user': 'Staff', // Default user to Staff
        'model': 'Model'
      }

      const mappedRole = roleMapping[roleParam.toLowerCase()]
      if (mappedRole) {
        setPreselectedRole(mappedRole)
        setIsLogin(false) // Force signup mode
        // Store preselected role in sessionStorage to persist through email verification
        sessionStorage.setItem('preselectedRole', mappedRole)
      }
    }

    // Handle invitation parameter (existing functionality)
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
      console.log('🔍 [AUTH] Starting auth state check...')
      try {
        // Use getUserWithProxy to handle both direct and proxy auth
        const { user, error } = await getUserWithProxy()
        const justVerified = searchParams?.get('verified') === 'true'

        console.log('🔍 [AUTH] Auth state details:', {
          hasUser: !!user,
          userId: user?.id,
          userEmail: user?.email,
          emailConfirmed: !!user?.email_confirmed_at,
          justVerified,
          error: error
        })
        
        if (user && (user.email_confirmed_at || justVerified)) {
          console.log('✅ [AUTH] Found verified user on page load:', user.id, { 
            justVerified,
            emailConfirmed: !!user.email_confirmed_at 
          })
          
          // Quick check if user already has a profile
          console.log('🔍 [AUTH] Checking user profile...')
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single()
          
          console.log('🔍 [AUTH] Profile check result:', {
            hasProfile: !!profileData,
            profileError: profileError?.code,
            profileErrorMessage: profileError?.message
          })
          
          if (profileError && profileError.code === 'PGRST116') {
            // User doesn't have profile yet - show role modal to complete registration
            console.log('✅ [AUTH] Verified user needs to complete profile - SHOWING ROLE MODAL')
            setEmail(user.email || '')
            setSignedUpUser(user)

            // Retrieve preselected role from sessionStorage if available
            const storedPreselectedRole = sessionStorage.getItem('preselectedRole')
            if (storedPreselectedRole) {
              setPreselectedRole(storedPreselectedRole)
              // Clear it after use
              sessionStorage.removeItem('preselectedRole')
            }

            setShowRoleModal(true)
            setIsPostVerificationFlow(true) // Track that this is after email verification
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
          console.log('⚠️ [AUTH] Will retry in 1 second...')
          setTimeout(() => {
            // Retry after a delay to allow session to be established
            console.log('🔄 [AUTH] Retrying auth state check...')
            checkAuthState()
          }, 1000)
          
          // Also set a backup timer to force role modal if session never appears
          if (!fallbackTriggered) {
            setTimeout(() => {
              console.log('🚨 [AUTH] FALLBACK: Session still not available after retries - forcing role modal')
              setFallbackTriggered(true)
              setShowRoleModal(true)
              setMessage('Please complete your profile to finish registration')
            }, 3000)
          }
        } else {
          console.log('ℹ️ [AUTH] No verified user found, showing normal auth flow')
        }
      } catch (error) {
        // Silently continue - don't block normal auth flow
        console.error('❌ [AUTH] Auth state check error:', error)
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

  // Enhanced retry mechanism for network failures with better error detection
  const retryWithDelay = async (fn: () => Promise<any>, maxRetries = 3, baseDelay = 1500, operationName = 'operation'): Promise<any> => {
    let lastError: any = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [AUTH-RETRY] Attempt ${attempt + 1}/${maxRetries + 1} for ${operationName}`)
        
        // Add timeout wrapper for each attempt
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout for ${operationName} after 10 seconds`)), 10000)
          )
        ])
        
        console.log(`✅ [AUTH-RETRY] ${operationName} succeeded on attempt ${attempt + 1}`)
        return result
        
      } catch (error: any) {
        lastError = error
        console.log(`⚠️ [AUTH-RETRY] Attempt ${attempt + 1} failed for ${operationName}:`, error.message)
        
        const isRetryableError = 
          error.message?.includes('fetch') || 
          error.name === 'NetworkError' || 
          error.message?.includes('Failed to fetch') ||
          error.message?.includes('timeout') ||
          error.message?.includes('Timeout') ||
          error.code === 'NETWORK_ERROR' ||
          error.code === 'TIMEOUT_ERROR' ||
          error.name === 'TypeError' && error.message?.includes('fetch')
        
        // Don't retry on authentication errors
        const isAuthError = 
          error.message?.includes('Invalid login credentials') ||
          error.message?.includes('Email not confirmed') ||
          error.message?.includes('User already registered') ||
          error.message?.includes('Invalid email')
        
        if (attempt === maxRetries || !isRetryableError || isAuthError) {
          console.log(`❌ [AUTH-RETRY] ${operationName} failed permanently:`, {
            finalAttempt: attempt === maxRetries,
            isRetryable: isRetryableError,
            isAuthError,
            errorMessage: error.message
          })
          throw error
        }
        
        // Calculate delay with exponential backoff and jitter
        const jitter = Math.random() * 500 // Add some randomness
        const delay = Math.min(baseDelay * Math.pow(1.5, attempt) + jitter, 8000) // Cap at 8 seconds
        
        console.log(`⏳ [AUTH-RETRY] Waiting ${Math.round(delay)}ms before retry ${attempt + 2}/${maxRetries + 1}`)
        setIsRetrying(true)
        setRetryCount(attempt + 1)
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    // This shouldn't be reached, but just in case
    throw lastError
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent concurrent submissions
    if (isSubmitting.current) {
      console.log('🚫 [AUTH] Submission already in progress, ignoring')
      return
    }
    
    // Debounce: prevent rapid successive submissions
    const now = Date.now()
    if (now - lastSubmissionTime.current < 2000) { // 2 second debounce
      console.log('🚫 [AUTH] Submission too rapid, ignoring')
      return
    }
    
    // Set guards
    isSubmitting.current = true
    lastSubmissionTime.current = now
    setLoading(true)
    setMessage('')
    
    // Validate terms acceptance for signup
    if (!isLogin && !agreedToTerms) {
      setMessage('Please agree to the Terms of Service and Privacy Policy')
      setLoading(false)
      isSubmitting.current = false
      return
    }
    
    // Check for email error
    if (!isLogin && emailError) {
      setMessage(emailError)
      setLoading(false)
      isSubmitting.current = false
      return
    }
    
    try {
      setIsRetrying(false)
      setRetryCount(0)
      
      // Execute auth flow - simplified approach
      if (isLogin) {
          console.log('🔐 Attempting login for:', email)
          
          // Try direct Supabase login first
          let loginSuccess = false
          let loginData: any = null
          let loginError: any = null
          let usedProxy = false
          
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password
            })

            if (error) {
              console.log('Direct login error:', error.message)
              loginError = error
            } else if (data?.user && data?.session) {
              console.log('✅ Direct login successful')
              loginSuccess = true
              loginData = data
            } else {
              loginError = new Error('Login failed - no session created')
            }
          } catch (error: any) {
            console.log('Direct login exception:', error.message)
            loginError = error
          }
          
          // If direct login failed, try proxy
          if (!loginSuccess) {
            usedProxy = true
            console.log('🔄 Using proxy for login due to connection issues')
            try {
              const proxyResponse = await fetch('/api/auth/proxy-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
              })

              const proxyData = await proxyResponse.json()

              if (proxyResponse.ok && proxyData.success) {
                console.log('✅ Proxy login successful - session established via cookies')
                // No need to call setSession - cookies are already set server-side

                // Small delay to ensure session cookies are set
                await new Promise(resolve => setTimeout(resolve, 500))

                console.log('✅ Redirecting to dashboard after proxy login')
                router.push('/dashboard')

                // Return early to avoid any error handling
                return
              } else {
                throw new Error(proxyData.error || 'Proxy login failed')
              }
            } catch (proxyError: any) {
              console.error('Both direct and proxy login failed')
              throw loginError || proxyError
            }
          }

          // Only reach here if direct login was successful
          if (loginSuccess && loginData) {
            console.log('✅ User logged in successfully via direct connection')

            // Small delay to ensure session cookies are set
            await new Promise(resolve => setTimeout(resolve, 500))

            console.log('✅ Redirecting to dashboard')
            router.push('/dashboard')
            return
          } else {
            throw new Error('Login failed - no user or session data returned')
          }
      } else {
        console.log('📝 [AUTH] Attempting signup for:', email)
        
        let signupData = null
        let signupError = null
        
        // Try direct signup first
        try {
          console.log('🔄 [AUTH] Trying direct signup...')
          const { data, error } = await supabase.auth.signUp({
            email,
            password
          })
          
          if (!error && data) {
            signupData = data
            console.log('✅ [AUTH] Direct signup successful')
          } else {
            signupError = error
            throw error || new Error('Direct signup failed')
          }
        } catch (directError) {
          console.log('⚠️ [AUTH] Direct signup failed, trying proxy...', directError.message)
          
          // Try proxy signup
          try {
            console.log('🔄 [AUTH] Using proxy signup...')
            const proxyResponse = await fetch('/api/auth/proxy-signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            })
            
            const proxyData = await proxyResponse.json()
            
            if (proxyResponse.ok && proxyData.success) {
              console.log('✅ [AUTH] Proxy signup successful')
              signupData = proxyData
            } else {
              throw new Error(proxyData.error || 'Proxy signup failed')
            }
          } catch (proxyError) {
            console.error('❌ [AUTH] Both direct and proxy signup failed')
            console.error('❌ [AUTH] Direct error:', signupError?.message)
            console.error('❌ [AUTH] Proxy error:', proxyError?.message)
            throw new Error(`Signup failed. Direct: ${signupError?.message || 'unknown'}. Proxy: ${proxyError?.message || 'unknown'}`)
          }
        }
        
        if (signupData && signupData.user) {
          console.log('✅ [AUTH] User signed up successfully:', signupData.user.id)
          
          // For invited users, skip email verification and go straight to role modal
          if (inviteData) {
            console.log('✅ [AUTH] Invited user - skipping email verification')
            setSignedUpUser(signupData.user)
            setTempPassword(password) // Store password for potential auto-login
            setShowRoleModal(true)
            return
          }
          
          // For regular users, check if email is confirmed
          if (signupData.user.email_confirmed_at || signupData.session) {
            console.log('✅ [AUTH] Email confirmed or session active - showing role modal')
            setSignedUpUser(signupData.user)
            setShowRoleModal(true)
          } else {
            console.log('📧 [AUTH] Email confirmation required for regular user')
            router.push(`/verify-email?email=${encodeURIComponent(email)}`)
          }
        } else {
          router.push(`/verify-email?email=${encodeURIComponent(email)}`)
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
      if (error.message?.includes('Email rate limit') || error.message?.includes('rate limit') || error.code === 'RATE_LIMIT_ERROR') {
        console.log('⚠️ Rate limit reached:', error.message)
        setMessage('Email rate limit reached. Please wait 10-15 minutes before trying again, or try logging in if you already have an account.')
      } else if (error.message?.includes('User already registered') || error.message?.includes('already exists') || error.message?.includes('already been registered')) {
        console.log('👤 User already exists')
        setMessage('This email is already registered. Click "Switch to Login" below to log in instead.')
      } else if (error.message?.includes('Invalid login credentials')) {
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
      } else if (error.name === 'AbortError') {
        console.log('⏰ Authentication failed: Request timeout')
        setMessage('Request timed out. Retrying automatically...')
      } else if (error.message?.includes('Failed to fetch') || error.name === 'TypeError' && error.message?.includes('fetch')) {
        console.log('🌐 Authentication failed: Failed to fetch')
        
        // Check if this looks like a connection reset or network issue
        if (error.message?.includes('net::ERR_CONNECTION_RESET') || 
            error.message?.includes('ERR_CONNECTION_RESET') ||
            error.message?.includes('Access to storage is not allowed')) {
          console.log('🔧 Connection Reset or Storage Access Issue detected')
          setMessage('Network connectivity issue detected. This may be due to firewall, VPN, or browser settings. Please try again or contact support if the issue persists.')
        } else {
          console.log('🔍 DEBUG: Check browser console and server logs for details')
          // Enhanced debug info for persistent fetch failures
          console.log('🔍 DEBUG INFO:', {
            errorName: error.name,
            errorMessage: error.message,
            currentUrl: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            retriesLeft: 'Check retry logs above'
          })
          // Show the actual error message for debugging
          setMessage(`Connection issue: ${error.message}. If this persists, please try using a different network or browser.`)
        }
      } else if (error.message?.includes('network') || error.name === 'NetworkError') {
        console.log('🌐 Authentication failed: Network error')
        setMessage('Connection error. Retrying automatically...')
      } else if (error.message?.includes('fetch')) {
        console.log('🌐 Authentication failed: Fetch error')
        setMessage('Network error. Retrying automatically...')
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
      isSubmitting.current = false
    }
  }

  const handleRoleModalClose = () => {
    setShowRoleModal(false)
    // Redirect to verification page even if user closes modal
    router.push(`/verify-email?email=${encodeURIComponent(email)}`)
  }

  const handleRoleModalComplete = async (role: string) => {
    setShowRoleModal(false)
    
    console.log('✅ [AUTH] Profile creation completed for role:', role)
    
    // Verify session exists before redirecting
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log('⚠️ [AUTH] No session found after profile creation')
        
        if (isPostVerificationFlow) {
          // This is expected for post-verification flow - show login form
          console.log('✅ [AUTH] Post-verification flow: Profile created, switching to login')
          setMessage('Profile created successfully! Please log in to continue.')
          setIsLogin(true) // Switch to login mode
          setShowRoleModal(false) // Close modal
          setPassword('') // Clear password field
          return
        } else {
          // For invited users, attempt auto-login
          if (inviteData && tempPassword && signedUpUser?.email) {
            console.log('🔄 [AUTH] No session found for invited user, attempting auto-login...')
            try {
              const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email: signedUpUser.email,
                password: tempPassword
              })

              if (loginError) {
                console.error('❌ [AUTH] Auto-login failed:', loginError.message)
                setMessage('Auto-login failed. Please log in manually.')
                setIsLogin(true)
                setPassword('')
                setTempPassword('')
                return
              }

              if (loginData?.session) {
                console.log('✅ [AUTH] Auto-login successful for invited user')
                setTempPassword('') // Clear stored password
                // Continue with redirect logic below
              } else {
                console.error('❌ [AUTH] Auto-login succeeded but no session created')
                setMessage('Login succeeded but session not established. Please try logging in again.')
                setIsLogin(true)
                setPassword('')
                setTempPassword('')
                return
              }
            } catch (error) {
              console.error('❌ [AUTH] Auto-login exception:', error)
              setMessage('Auto-login failed. Please log in manually.')
              setIsLogin(true)
              setPassword('')
              setTempPassword('')
              return
            }
          } else {
            // This shouldn't happen in normal flow
            console.log('❌ [AUTH] Unexpected: No session in normal flow')
            setMessage('Session error. Please log in again.')
            setIsLogin(true)
            setPassword('')
            return
          }
        }
      }
      console.log('✅ [AUTH] Session verified, proceeding with redirect')
    } catch (error) {
      console.error('❌ [AUTH] Session verification failed:', error)
      setMessage('Session error. Please log in again.')
      return
    }
    
    if (role === 'Admin') {
      console.log('✅ [AUTH] Admin user registered - redirecting to dashboard')
      router.push('/dashboard')
    } else {
      console.log('✅ [AUTH] Staff user registered - redirecting to pending approval')
      router.push('/pending-approval')
    }
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
              disabled={loading || isSubmitting.current}
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
        preselectedRole={preselectedRole}  // Pass pre-selected role from URL
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