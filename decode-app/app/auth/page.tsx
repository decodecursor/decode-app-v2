'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
import RoleSelectionModal from '@/components/RoleSelectionModal'
import ModelRegistrationModal from '@/components/ModelRegistrationModal'
import { safeLocalStorage, safeSessionStorage } from '@/utils/storage-helper'
import { COUNTRY_CODES } from '@/lib/country-codes'

type AuthMethod = 'select' | 'email' | 'whatsapp'
type AuthStep = 'input' | 'verify' | 'success'

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // State
  const [authMethod, setAuthMethod] = useState<AuthMethod>('select')
  const [authStep, setAuthStep] = useState<AuthStep>('input')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState('+971')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [emailLoading, setEmailLoading] = useState(false)
  const [whatsappLoading, setWhatsappLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [inviteData, setInviteData] = useState<any>(null)
  const [preselectedRole, setPreselectedRole] = useState<string | null>(null)
  const [authenticatedEmail, setAuthenticatedEmail] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authTimeout, setAuthTimeout] = useState(false)

  // Format phone number for display (XX XXX XXXX)
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`
  }

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message && message.toLowerCase().includes('error')) {
      const timer = setTimeout(() => setMessage(''), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  // Handle resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  // Restore preselected role from storage on mount (only if role parameter present)
  useEffect(() => {
    const roleParam = searchParams?.get('role')
    const storedRole = safeSessionStorage.getItem('preselectedRole') || safeLocalStorage.getItem('decode_preselectedRole')

    // Only restore if there's a role parameter in URL or stored role matches current context
    if (storedRole && !preselectedRole && roleParam) {
      console.log('🔄 [AUTH] Restoring preselected role from storage:', storedRole)
      setPreselectedRole(storedRole)
    }
  }, [searchParams])

  // Handle invite parameter and pre-selected role from URL
  useEffect(() => {
    const inviteParam = searchParams?.get('invite')
    const roleParam = searchParams?.get('role')
    const verifiedParam = searchParams?.get('verified')

    // Handle pre-selected role for direct registration links
    if (roleParam) {
      const roleMapping: { [key: string]: string } = {
        'admin': 'Admin',
        'user': 'Staff',
        'model': 'Model'
      }
      const mappedRole = roleMapping[roleParam.toLowerCase()]
      console.log('🎯 [AUTH] URL role parameter:', roleParam, '→ Mapped to:', mappedRole)
      if (mappedRole) {
        console.log('✅ [AUTH] Setting preselected role:', mappedRole)
        setPreselectedRole(mappedRole)
        safeSessionStorage.setItem('preselectedRole', mappedRole)
        safeLocalStorage.setItem('decode_preselectedRole', mappedRole)
      }
    } else if (!verifiedParam) {
      // Only clear if NOT coming from a preselected role flow
      // Check localStorage first - if it has a role, user came from model/admin URL
      const existingRole = safeLocalStorage.getItem('decode_preselectedRole')
      if (!existingRole) {
        console.log('🧹 [AUTH] No role parameter, not verified, no stored role - clearing')
        safeSessionStorage.removeItem('preselectedRole')
        setPreselectedRole(null)
      } else {
        console.log('🔄 [AUTH] No role param but found stored role:', existingRole)
        setPreselectedRole(existingRole)
      }
    } else {
      // Coming from magic link (verified=true), preserve stored role
      // Prioritize localStorage (persists across tabs) over sessionStorage (tab-specific)
      const storedRole = safeLocalStorage.getItem('decode_preselectedRole') || safeSessionStorage.getItem('preselectedRole')
      if (storedRole) {
        console.log('🔄 [AUTH] Magic link return - preserving stored role:', storedRole)
        setPreselectedRole(storedRole)
      }
    }

    // Handle invitation parameter
    if (inviteParam) {
      try {
        const decodedData = JSON.parse(Buffer.from(inviteParam, 'base64').toString())
        setInviteData(decodedData)
        setEmail(decodedData.email || '')
        setMessage(`Welcome! You've been invited to join ${decodedData.companyName}`)

        const inviteDataStr = JSON.stringify(decodedData)
        safeSessionStorage.setItem('inviteData', inviteDataStr)
        safeLocalStorage.setItem('decode_inviteData', inviteDataStr)
        safeLocalStorage.setItem('decode_inviteTimestamp', Date.now().toString())
      } catch (error) {
        console.error('❌ [AUTH] Invalid invite link:', error)
        setMessage('Invalid invitation link')
      }
    }

    // Handle email verification return
    if (verifiedParam === 'true') {
      handleMagicLinkReturn()
    }
  }, [searchParams])

  // Check for authenticated user (handles email verification returns)
  const checkAuthState = async () => {
    setIsCheckingAuth(true)
    try {
      const { user } = await getUserWithProxy()

      if (user && user.email_confirmed_at) {
        console.log('✅ [AUTH] Found verified user:', user.id)

        // Store user email for role modal
        if (user.email) {
          setAuthenticatedEmail(user.email)
        }

        // Check if user has a profile
        const { data: profileData } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()

        if (profileData) {
          // User has profile, use full page navigation for middleware (mobile fix)
          window.location.href = '/dashboard'
        } else {
          // Show role selection modal
          setShowRoleModal(true)
        }
      }
    } catch (error) {
      console.error('❌ [AUTH] Error checking auth state:', error)
    } finally {
      setIsCheckingAuth(false)
    }
  }

  // Handle magic link return with proper token processing wait
  const handleMagicLinkReturn = async (retryCount = 0) => {
    console.log(`🔗 [AUTH] Magic link detected (attempt ${retryCount + 1}), waiting for token processing...`)
    setIsCheckingAuth(true)
    setAuthError(null)
    setAuthTimeout(false)

    // MOBILE FIX: Extract tokens from hash fragment manually
    // Mobile browsers may not auto-process hash tokens properly (Safari ITP, cookie restrictions)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.substring(1)
      if (hash) {
        const hashParams = new URLSearchParams(hash)
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          console.log('🔑 [AUTH] Found tokens in hash, manually setting session for mobile compatibility')
          try {
            // Set session client-side
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            })

            if (!sessionError) {
              console.log('✅ [AUTH] Manual session set successful')

              // Also set via server proxy for cookie persistence on mobile
              try {
                await fetch('/api/auth/proxy-user', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken })
                })
                console.log('✅ [AUTH] Server-side cookie set via proxy')
              } catch (proxyError) {
                console.warn('⚠️ [AUTH] Proxy cookie set failed, but client session is set:', proxyError)
              }

              // Clear hash from URL for security
              window.history.replaceState(null, '', window.location.pathname + window.location.search)

              // Proceed with authentication
              await proceedWithAuthentication()
              return
            } else {
              console.error('❌ [AUTH] Manual session set failed:', sessionError)
            }
          } catch (tokenError) {
            console.error('❌ [AUTH] Manual token extraction failed:', tokenError)
            // Fall through to existing SDK-based logic
          }
        }
      }
    }

    // Set timeout for 10 seconds
    const timeoutId = setTimeout(() => {
      console.error('⏱️ [AUTH] Token processing timeout after 10s')
      setAuthTimeout(true)
      setIsCheckingAuth(false)

      // Auto-retry once after 2 seconds if this is the first attempt
      if (retryCount === 0) {
        console.log('🔄 [AUTH] Auto-retrying in 2 seconds...')
        setTimeout(() => {
          handleMagicLinkReturn(1)
        }, 2000)
      } else {
        setAuthError('Authentication took too long. The link may have expired.')
      }
    }, 10000)

    try {
      // Wait for Supabase SDK to process tokens from hash fragment
      // The SDK's onAuthStateChange will fire when tokens are processed
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        // Tokens already processed, clear timeout and proceed
        clearTimeout(timeoutId)
        console.log('✅ [AUTH] Session found immediately')
        await proceedWithAuthentication()
      } else {
        // Wait for auth state change event (tokens being processed)
        console.log('⏳ [AUTH] Waiting for auth state change...')

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('🔔 [AUTH] Auth state changed:', event)

          if (event === 'SIGNED_IN' && session) {
            clearTimeout(timeoutId)
            authListener.subscription.unsubscribe()
            await proceedWithAuthentication()
          } else if (event === 'TOKEN_REFRESHED' && session) {
            clearTimeout(timeoutId)
            authListener.subscription.unsubscribe()
            await proceedWithAuthentication()
          }
        })
      }
    } catch (error: any) {
      clearTimeout(timeoutId)
      console.error('❌ [AUTH] Error during magic link processing:', error)
      setIsCheckingAuth(false)

      // Auto-retry once after 2 seconds if this is the first attempt
      if (retryCount === 0) {
        console.log('🔄 [AUTH] Auto-retrying in 2 seconds...')
        setTimeout(() => {
          handleMagicLinkReturn(1)
        }, 2000)
      } else {
        setAuthError(error.message || 'Failed to process authentication link.')
      }
    }
  }

  // Proceed with authentication after tokens are verified
  const proceedWithAuthentication = async () => {
    try {
      const { user } = await getUserWithProxy()

      if (user && user.email_confirmed_at) {
        console.log('✅ [AUTH] User verified:', user.id)

        // Store user email for role modal
        if (user.email) {
          setAuthenticatedEmail(user.email)
        }

        // ALWAYS restore preselected role before showing modal
        // Read directly from URL params to bypass React async state timing issues
        const urlParams = new URLSearchParams(window.location.search);
        const urlRole = urlParams.get('role');
        const roleMapping: { [key: string]: string } = {
          'admin': 'Admin',
          'user': 'Staff',
          'model': 'Model'
        };
        const mappedUrlRole = urlRole ? roleMapping[urlRole.toLowerCase()] : null;

        // Priority: URL role param > localStorage (cross-tab) > sessionStorage (tab-specific)
        const storedRole = mappedUrlRole ||
                           safeLocalStorage.getItem('decode_preselectedRole') ||
                           safeSessionStorage.getItem('preselectedRole');
        if (storedRole) {
          console.log('🔄 [AUTH] Setting preselected role from URL/storage:', storedRole, '(was:', preselectedRole, ')');
          setPreselectedRole(storedRole);
          // Ensure storage is updated synchronously before modal renders
          safeSessionStorage.setItem('preselectedRole', storedRole);
          safeLocalStorage.setItem('decode_preselectedRole', storedRole);
        }

        // Check if user has a profile
        const { data: profileData } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()

        if (profileData) {
          // User has profile, verify session is properly set before redirecting
          console.log('✅ [AUTH] User has profile, verifying session before redirect...')

          // Verify session is properly established (critical for mobile)
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) {
            console.error('❌ [AUTH] Session not established after authentication')
            setIsCheckingAuth(false)
            setAuthError('Session could not be established. Please try again.')
            return
          }

          console.log('✅ [AUTH] Session verified, redirecting to dashboard')
          // Use full page navigation to ensure middleware runs (critical for mobile)
          window.location.href = '/dashboard'
          return
        } else {
          // Show role selection modal
          console.log('🆕 [AUTH] New user, showing role modal')
          setShowRoleModal(true)
          setIsCheckingAuth(false) // Allow modal to show
        }
      } else {
        // No verified user found
        setIsCheckingAuth(false)
        setAuthError('Authentication failed. The link may have expired or already been used.')
      }
    } catch (error: any) {
      console.error('❌ [AUTH] Error verifying user:', error)
      setIsCheckingAuth(false)
      setAuthError('Failed to verify your account. Please try again.')
    }
  }

  // Get app URL with proper fallbacks
  const getAppUrl = () => {
    // Try environment variable first
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL;
    }

    // Try window location for development
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return window.location.origin;
    }

    // Hardcoded production URL as final fallback
    return 'https://app.welovedecode.com';
  };

  // Email magic link handler
  const handleEmailSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setEmailLoading(true)
    setMessage('')

    const redirectUrl = getAppUrl();
    console.log('🔍 [AUTH] Using redirect URL:', redirectUrl);

    try {
      // Preserve role parameter in magic link redirect
      // Read from storage as fallback for React state timing issues
      // Prioritize localStorage (persists across tabs) over sessionStorage
      const effectiveRoleForLink = preselectedRole ||
                                    safeLocalStorage.getItem('decode_preselectedRole') ||
                                    safeSessionStorage.getItem('preselectedRole');
      const roleParam = effectiveRoleForLink ? `&role=${effectiveRoleForLink.toLowerCase()}` : '';
      // Use Supabase Auth magic link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${redirectUrl}/auth?verified=true${roleParam}`,
        }
      })

      if (error) throw error

      // Store email for role modal
      setAuthenticatedEmail(email)

      // Switch to email verify screen
      setAuthMethod('email')
      setAuthStep('verify')
      setMessage('Magic link sent! Check your email and click the link to sign in.')
      setResendCooldown(60)
    } catch (error: any) {
      console.error('❌ [AUTH] Magic link error:', error)
      setMessage(error.message || 'Failed to send magic link. Please try again.')
    } finally {
      setEmailLoading(false)
    }
  }

  // WhatsApp OTP send handler
  const handleWhatsAppSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setWhatsappLoading(true)
    setMessage('')

    const fullPhone = `${countryCode}${phoneNumber}`

    try {
      const response = await fetch('/api/auth/send-whatsapp-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: fullPhone })
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to send OTP')

      // Switch to WhatsApp verify screen
      setAuthMethod('whatsapp')
      setAuthStep('verify')
      setMessage('OTP sent to your WhatsApp! Enter the 6-digit code.')
      setResendCooldown(60)
    } catch (error: any) {
      console.error('❌ [AUTH] WhatsApp OTP error:', error)
      setMessage(error.message || 'Failed to send OTP. Please try again.')
    } finally {
      setWhatsappLoading(false)
    }
  }

  // WhatsApp OTP verification handler
  const handleOTPVerify = async () => {
    const code = otpCode.join('')
    if (code.length !== 6) {
      setMessage('Please enter the complete 6-digit code')
      return
    }

    setWhatsappLoading(true)
    setMessage('')

    const fullPhone = `${countryCode}${phoneNumber}`

    try {
      const response = await fetch('/api/auth/verify-whatsapp-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: fullPhone,
          otpCode: code
        })
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Invalid OTP code')

      // OTP verified successfully
      console.log('✅ [AUTH] WhatsApp OTP verified')

      // Store phone as placeholder email for role modal
      setAuthenticatedEmail(`${fullPhone}@whatsapp.user`)

      // Wait a moment for backend to create session
      await new Promise(resolve => setTimeout(resolve, 500))

      // Refresh session to get latest auth state
      await supabase.auth.refreshSession()

      // Check if user has profile
      if (data.user?.hasProfile) {
        // User has profile, use full page navigation for middleware (mobile fix)
        console.log('✅ [AUTH] User has profile, redirecting to dashboard')
        window.location.href = '/dashboard'
      } else {
        // Show role selection modal for new users
        console.log('🆕 [AUTH] New user, showing role selection')
        setShowRoleModal(true)
      }
    } catch (error: any) {
      console.error('❌ [AUTH] OTP verification error:', error)
      setMessage(error.message || 'Invalid code. Please try again.')
    } finally {
      setWhatsappLoading(false)
    }
  }

  // OTP input handler (auto-advance to next field)
  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return // Only allow digits

    const newOTP = [...otpCode]
    newOTP[index] = value.slice(-1) // Only take last digit
    setOtpCode(newOTP)

    // Auto-advance to next field
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }

    // Auto-verify when all 6 digits entered
    if (index === 5 && value) {
      const code = newOTP.join('')
      if (code.length === 6) {
        setTimeout(() => handleOTPVerify(), 100)
      }
    }
  }

  // OTP backspace handler
  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  // Resend handler
  const handleResend = async () => {
    if (resendCooldown > 0) return

    if (authMethod === 'email') {
      await handleEmailSubmit({ preventDefault: () => {} } as React.FormEvent)
    } else if (authMethod === 'whatsapp') {
      await handleWhatsAppSubmit({ preventDefault: () => {} } as React.FormEvent)
    }
  }

  // Role modal handlers
  const handleRoleModalComplete = async (role: string) => {
    setShowRoleModal(false)
    console.log('✅ [AUTH] Profile creation completed for role:', role)
    window.location.href = '/dashboard?new_user=true'
  }

  // Reset to start
  const handleBack = () => {
    setAuthMethod('select')
    setAuthStep('input')
    setMessage('')
    setOtpCode(['', '', '', '', '', ''])
  }

  // Show loading screen when checking auth after magic link
  if (isCheckingAuth) {
    return (
      <div className="cosmic-bg-model min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          {!authError ? (
            <div className="rounded-xl overflow-hidden shadow-lg">
              <AITextLoading />
            </div>
          ) : (
            <>
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-white text-xl font-bold mb-3">Authentication Failed</h2>
              <p className="text-gray-300 mb-6">{authError}</p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setAuthError(null)
                    setAuthTimeout(false)
                    handleMagicLinkReturn()
                  }}
                  className="cosmic-button-primary w-full py-3"
                >
                  Try Again
                </button>
                <button
                  onClick={() => {
                    setIsCheckingAuth(false)
                    setAuthError(null)
                    setAuthTimeout(false)
                    setAuthMethod('select')
                    setAuthStep('input')
                  }}
                  className="cosmic-button-secondary w-full py-3"
                >
                  Back to Login
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-6">
                {authTimeout
                  ? 'The authentication link may have expired. Request a new one.'
                  : 'If this problem persists, try requesting a new magic link.'}
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  // Render single-page auth with both options
  if (authMethod === 'select') {
    // ALWAYS read from multiple sources - URL params, storage, and state
    // This handles all edge cases: new tabs, storage cleared, state timing issues
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const urlRole = urlParams?.get('role')
    const urlRoleMapping: { [key: string]: string } = { 'admin': 'Admin', 'user': 'Staff', 'model': 'Model' }
    const mappedUrlRole = urlRole ? urlRoleMapping[urlRole.toLowerCase()] : null
    const storedRole = safeLocalStorage.getItem('decode_preselectedRole') || safeSessionStorage.getItem('preselectedRole')
    // Priority: URL params > storage > state (trust fresh URL params first)
    const effectiveRole = mappedUrlRole || storedRole || preselectedRole
    // Normalize role for comparison (case-insensitive)
    const normalizedRole = effectiveRole?.toLowerCase()
    const isModelRole = normalizedRole === 'model'
    const isAdminOrStaff = normalizedRole === 'admin' || normalizedRole === 'staff'
    console.log('🎬 [AUTH] Modal rendering - mappedUrlRole:', mappedUrlRole, 'storedRole:', storedRole, 'preselectedRole:', preselectedRole, 'effectiveRole:', effectiveRole, 'isModelRole:', isModelRole, 'showRoleModal:', showRoleModal)

    return (
      <>
        {isModelRole ? (
          <ModelRegistrationModal
            isOpen={showRoleModal}
            userEmail={authenticatedEmail || email}
            onComplete={handleRoleModalComplete}
          />
        ) : isAdminOrStaff ? (
          <RoleSelectionModal
            isOpen={showRoleModal}
            userEmail={authenticatedEmail || email}
            termsAcceptedAt={new Date().toISOString()}
            inviteData={inviteData}
            preselectedRole={effectiveRole}
            onClose={() => setShowRoleModal(false)}
            onComplete={handleRoleModalComplete}
          />
        ) : (
          // Default to RoleSelectionModal only if no role specified
          <RoleSelectionModal
            isOpen={showRoleModal}
            userEmail={authenticatedEmail || email}
            termsAcceptedAt={new Date().toISOString()}
            inviteData={inviteData}
            preselectedRole={effectiveRole}
            onClose={() => setShowRoleModal(false)}
            onComplete={handleRoleModalComplete}
          />
        )}
      <div className="auth-page cosmic-bg-model">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card-login">
            {/* Model Registration Badge - Show when preselectedRole is Model */}
            {preselectedRole === 'Model' && (
              <div className="mb-8 flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-full">
                  <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-semibold text-purple-300">Model Registration</span>
                </div>
              </div>
            )}

            {/* Logo and Tagline */}
            <div className="text-center mb-12">
              <img
                src="/logo.png"
                alt="DECODE"
                className="mx-auto mb-2"
                style={{ height: '40px', filter: 'brightness(0) invert(1)' }}
              />
              <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
            </div>

            {/* WhatsApp Section */}
            <div className="space-y-2 mb-6">
              <div className="flex space-x-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="cosmic-input text-sm border border-purple-500 !w-[117px] md:!w-[92px]"
                  disabled={emailLoading || whatsappLoading}
                >
                  {COUNTRY_CODES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code}
                    </option>
                  ))}
                </select>

                <input
                  type="tel"
                  placeholder="50 123 4567"
                  value={formatPhoneNumber(phoneNumber)}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="cosmic-input flex-1"
                  disabled={emailLoading || whatsappLoading}
                  autoComplete="tel"
                />
              </div>

              <button
                onClick={handleWhatsAppSubmit}
                className={`w-full py-3 text-base rounded-lg font-medium transition-all ${
                  phoneNumber
                    ? 'bg-black border border-purple-600 hover:border-purple-700'
                    : 'bg-gradient-to-br from-gray-700 to-black hover:bg-purple-600'
                } ${whatsappLoading || !phoneNumber ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={whatsappLoading || !phoneNumber}
              >
                {whatsappLoading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    <span>Sending...</span>
                  </span>
                ) : (
                  'Continue with WhatsApp'
                )}
              </button>
            </div>

            {/* OR Divider */}
            <div className="relative my-5">
              <div className="relative flex justify-center text-sm">
                <span className="text-gray-400 font-light">OR</span>
              </div>
            </div>

            {/* Email Section */}
            <form onSubmit={handleEmailSubmit} className="space-y-2">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="cosmic-input"
                disabled={emailLoading || whatsappLoading}
                autoComplete="email"
              />

              <button
                type="submit"
                className={`w-full py-3 text-base rounded-lg font-medium transition-all ${
                  email
                    ? 'bg-black border border-purple-600 hover:border-purple-700'
                    : 'bg-gradient-to-br from-gray-700 to-black hover:bg-purple-600'
                } ${emailLoading || !email ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={emailLoading || !email}
              >
                {emailLoading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    <span>Sending...</span>
                  </span>
                ) : (
                  'Continue with Email'
                )}
              </button>
            </form>

            {/* Error/Success Messages */}
            {message && (
              <div className={`mt-6 p-3 rounded-lg text-sm text-center ${
                message.toLowerCase().includes('error')
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {message}
              </div>
            )}

            {/* Terms and Privacy */}
            <p className="text-center text-gray-400 font-light mt-8" style={{ fontSize: '12px' }}>
              By continuing, you agree to DECODE's<br />
              <a href="https://welovedecode.com/#terms" className="hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="https://welovedecode.com/#privacy" className="hover:underline">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
      </>
    )
  }

  // Render email magic link flow
  if (authMethod === 'email') {
    if (authStep === 'verify') {
      return (
        <div className="auth-page cosmic-bg-model">
          <div className="min-h-screen flex items-center justify-center px-4 py-8">
            <div className="cosmic-card-login">
              <div className="text-center mb-16">
                <img
                  src="/logo.png"
                  alt="DECODE"
                  className="mx-auto mb-2"
                  style={{ height: '40px', filter: 'brightness(0) invert(1)' }}
                />
                <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
              </div>

              <div className="text-center mb-8">
                <div className="text-6xl mb-4">📬</div>
                <p className="text-gray-400">
                  We sent a magic link to<br />
                  <span className="text-white font-medium">{email}</span>
                </p>
              </div>

              <div className="space-y-4 mt-10">
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || emailLoading}
                  className="cosmic-button-secondary w-full"
                >
                  {resendCooldown > 0
                    ? `Resend magic link in ${resendCooldown}s`
                    : 'Resend magic link'}
                </button>

                <button
                  onClick={handleBack}
                  className="text-gray-400 hover:text-white w-full py-2 text-sm"
                >
                  ← Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="auth-page cosmic-bg-model">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card-login">
            <div className="text-center mb-16">
              <img
                src="/logo.png"
                alt="DECODE"
                className="mx-auto mb-2"
                style={{ height: '40px', filter: 'brightness(0) invert(1)' }}
              />
              <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
            </div>

            <button
              onClick={handleBack}
              className="text-gray-400 hover:text-white mb-6 flex items-center space-x-2"
            >
              <span>←</span>
              <span>Back</span>
            </button>

            <h2 className="text-2xl font-bold text-white mb-2">Sign in with Email</h2>
            <p className="text-gray-400 mb-8">
              We'll send you a magic link for a password-free sign in.
            </p>

            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="cosmic-input"
                  required
                  disabled={emailLoading}
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                className="cosmic-button-primary w-full py-3"
                disabled={emailLoading || !email}
              >
                {emailLoading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    <span>Sending...</span>
                  </span>
                ) : (
                  'Send magic link'
                )}
              </button>
            </form>

            {message && (
              <div className={`mt-6 p-3 rounded-lg text-sm text-center ${
                message.toLowerCase().includes('error')
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render WhatsApp OTP flow
  if (authMethod === 'whatsapp') {
    if (authStep === 'verify') {
      return (
        <div className="auth-page cosmic-bg-model">
          <div className="min-h-screen flex items-center justify-center px-4 py-8">
            <div className="cosmic-card-login">
              <div className="text-center mb-16">
                <img
                  src="/logo.png"
                  alt="DECODE"
                  className="mx-auto mb-2"
                  style={{ height: '40px', filter: 'brightness(0) invert(1)' }}
                />
                <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
              </div>

              <div className="text-center mb-8">
                <div className="text-6xl mb-4">💬</div>
                <h2 className="text-2xl font-bold text-white mb-2">Enter verification code</h2>
                <p className="text-gray-400">
                  We sent a 6-digit code to <span className="text-white font-medium">{countryCode}{phoneNumber}</span>
                </p>
              </div>

              <div className="flex justify-center space-x-2 mb-6">
                {otpCode.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOTPChange(index, e.target.value)}
                    onKeyDown={(e) => handleOTPKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold cosmic-input"
                    disabled={whatsappLoading}
                  />
                ))}
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleOTPVerify}
                  className="cosmic-button-primary w-full py-3"
                  disabled={whatsappLoading || otpCode.join('').length !== 6}
                >
                  {whatsappLoading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      <span>Verifying...</span>
                    </span>
                  ) : (
                    'Verify code'
                  )}
                </button>

                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || whatsappLoading}
                  className="cosmic-button-secondary w-full"
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend code'}
                </button>

                <button
                  onClick={handleBack}
                  className="text-gray-400 hover:text-white w-full py-2 text-sm"
                >
                  ← Back to sign in
                </button>
              </div>

              {message && (
                <div className={`mt-6 p-3 rounded-lg text-sm text-center ${
                  message.toLowerCase().includes('error')
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="auth-page cosmic-bg-model">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card-login">
            <div className="text-center mb-16">
              <img
                src="/logo.png"
                alt="DECODE"
                className="mx-auto mb-2"
                style={{ height: '40px', filter: 'brightness(0) invert(1)' }}
              />
              <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
            </div>

            <button
              onClick={handleBack}
              className="text-gray-400 hover:text-white mb-6 flex items-center space-x-2"
            >
              <span>←</span>
              <span>Back</span>
            </button>

            <h2 className="text-2xl font-bold text-white mb-2">Sign in with WhatsApp</h2>
            <p className="text-gray-400 mb-8">
              We'll send a verification code to your WhatsApp number.
            </p>

            <form onSubmit={handleWhatsAppSubmit} className="space-y-6">
              <div className="flex space-x-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="cosmic-input w-32"
                  disabled={whatsappLoading}
                >
                  {COUNTRY_CODES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code}
                    </option>
                  ))}
                </select>

                <input
                  type="tel"
                  placeholder="Phone number"
                  value={formatPhoneNumber(phoneNumber)}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="cosmic-input flex-1"
                  required
                  disabled={whatsappLoading}
                  autoComplete="tel"
                />
              </div>

              <button
                type="submit"
                className="cosmic-button-primary w-full py-3"
                disabled={whatsappLoading || !phoneNumber}
              >
                {whatsappLoading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    <span>Sending...</span>
                  </span>
                ) : (
                  'Send verification code'
                )}
              </button>
            </form>

            {message && (
              <div className={`mt-6 p-3 rounded-lg text-sm text-center ${
                message.toLowerCase().includes('error')
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Fallback return - should never reach here but just in case
  // ALWAYS read from storage first as primary source of truth (loading state)
  const storedRole = safeSessionStorage.getItem('preselectedRole') || safeLocalStorage.getItem('decode_preselectedRole')
  const effectiveRole = storedRole || preselectedRole
  console.log('🎬 [AUTH] Loading state - Modal rendering - storedRole:', storedRole, 'preselectedRole:', preselectedRole, 'effectiveRole:', effectiveRole, 'showRoleModal:', showRoleModal)

  return (
    <>
      <div className="auth-page cosmic-bg-model">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>

      {/* Role Selection Modal */}
      {effectiveRole === 'Model' ? (
        <ModelRegistrationModal
          isOpen={showRoleModal}
          userEmail={authenticatedEmail || email}
          onComplete={handleRoleModalComplete}
        />
      ) : effectiveRole === 'Admin' || effectiveRole === 'Staff' ? (
        <RoleSelectionModal
          isOpen={showRoleModal}
          userEmail={authenticatedEmail || email}
          termsAcceptedAt={new Date().toISOString()}
          inviteData={inviteData}
          preselectedRole={effectiveRole}
          onClose={() => setShowRoleModal(false)}
          onComplete={handleRoleModalComplete}
        />
      ) : (
        // Default to RoleSelectionModal only if no role specified
        <RoleSelectionModal
          isOpen={showRoleModal}
          userEmail={authenticatedEmail || email}
          termsAcceptedAt={new Date().toISOString()}
          inviteData={inviteData}
          preselectedRole={effectiveRole}
          onClose={() => setShowRoleModal(false)}
          onComplete={handleRoleModalComplete}
        />
      )}
    </>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="auth-page cosmic-bg-model">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="rounded-xl overflow-hidden shadow-lg">
            <AITextLoading />
          </div>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  )
}
