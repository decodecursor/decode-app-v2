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
        
        if (user && user.email_confirmed_at) {
          console.log('✅ [AUTH] Found verified user on page load:', user.id)
          console.log('✅ [AUTH] Email confirmed at:', user.email_confirmed_at)
          
          // Check if user already has a profile in database
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
        }
      } catch (error) {
        console.error('Error checking auth state:', error)
      }
    }
    
    checkAuthState()
  }, [router, supabase])

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
      
      // Execute auth flow with retry logic
      await retryWithDelay(async () => {        
        if (isLogin) {
          console.log('🔐 Attempting login for:', email)
          console.log('🔧 Supabase client URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
          console.log('🔧 Supabase key present:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'YES' : 'NO')
          console.log('🔧 Current domain:', window.location.origin)
          
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          })
          
          console.log('🔍 Login response data:', data)
          console.log('🔍 Login response error:', error)
          
          if (error) {
            console.error('❌ Login error:', error)
            throw error
          }
          
          if (data.user && data.session) {
            console.log('✅ User logged in successfully:', data.user.id)
            console.log('✅ Session established:', data.session.access_token.substring(0, 20) + '...')
            
            // Wait for session to be properly stored before redirect
            await new Promise(resolve => setTimeout(resolve, 100))
            
            // Verify session is accessible
            const { data: sessionCheck } = await supabase.auth.getSession()
            if (sessionCheck.session) {
              console.log('✅ Session verified, redirecting to dashboard')
              router.push('/dashboard')
            } else {
              console.error('❌ Session not found after login')
              throw new Error('Session was not properly established')
            }
            return data
          } else {
            throw new Error('Login failed - no user or session data returned')
          }
        } else {
          console.log('📝 [AUTH] Attempting signup for:', email)
          console.log('📝 [AUTH] Has invite data:', !!inviteData)
          
          const { data, error } = await Promise.race([
            supabase.auth.signUp({
              email,
              password
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Signup timeout after 10 seconds')), 10000)
            )
          ])
          
          console.log('📝 [AUTH] Signup response data:', data)
          console.log('📝 [AUTH] Signup response error:', error)
          
          if (error) {
            console.error('❌ [AUTH] Signup error:', error)
            throw error
          }
          
          if (data.user) {
            console.log('✅ [AUTH] User signed up successfully:', data.user.id)
            console.log('✅ [AUTH] User confirmed status:', data.user.email_confirmed_at ? 'CONFIRMED' : 'NOT CONFIRMED')
            console.log('✅ [AUTH] Session created:', !!data.session)
            console.log('✅ [AUTH] Is invited user:', !!inviteData)
            
            // For invited users, skip email verification and go straight to role modal
            if (inviteData) {
              console.log('✅ [AUTH] Invited user - skipping email verification')
              setSignedUpUser(data.user)
              setShowRoleModal(true)
              return data
            }
            
            // For regular users, check if email is confirmed
            if (data.user.email_confirmed_at || data.session) {
              console.log('✅ [AUTH] Email confirmed or session active - showing role modal')
              setSignedUpUser(data.user)
              setShowRoleModal(true)
              return data
            } else {
              console.log('📧 [AUTH] Email confirmation required for regular user')
              router.push(`/verify-email?email=${encodeURIComponent(email)}`)
              return data
            }
          } else {
            // No user object means email confirmation required
            console.log('📧 [AUTH] No user object - email confirmation required')
            router.push(`/verify-email?email=${encodeURIComponent(email)}`)
            return data
          }
        }
      })
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