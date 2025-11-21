'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
import RoleSelectionModal from '@/components/RoleSelectionModal'
import { safeLocalStorage, safeSessionStorage } from '@/utils/storage-helper'

// Country codes for phone input
const COUNTRY_CODES = [
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+1', country: 'USA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
]

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
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [inviteData, setInviteData] = useState<any>(null)
  const [preselectedRole, setPreselectedRole] = useState<string | null>(null)
  const [authenticatedEmail, setAuthenticatedEmail] = useState('')

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
      if (mappedRole) {
        setPreselectedRole(mappedRole)
        safeSessionStorage.setItem('preselectedRole', mappedRole)
        safeLocalStorage.setItem('decode_preselectedRole', mappedRole)
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
      checkAuthState()
    }
  }, [searchParams])

  // Check for authenticated user (handles email verification returns)
  const checkAuthState = async () => {
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
          // User has profile, redirect to dashboard
          router.push('/dashboard')
        } else {
          // Show role selection modal
          setShowRoleModal(true)
        }
      }
    } catch (error) {
      console.error('❌ [AUTH] Error checking auth state:', error)
    }
  }

  // Email magic link handler
  const handleEmailSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Use Supabase Auth magic link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?verified=true`,
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
      setLoading(false)
    }
  }

  // WhatsApp OTP send handler
  const handleWhatsAppSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
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
      setLoading(false)
    }
  }

  // WhatsApp OTP verification handler
  const handleOTPVerify = async () => {
    const code = otpCode.join('')
    if (code.length !== 6) {
      setMessage('Please enter the complete 6-digit code')
      return
    }

    setLoading(true)
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
        // User has profile, redirect to dashboard
        console.log('✅ [AUTH] User has profile, redirecting to dashboard')
        router.push('/dashboard')
      } else {
        // Show role selection modal for new users
        console.log('🆕 [AUTH] New user, showing role selection')
        setShowRoleModal(true)
      }
    } catch (error: any) {
      console.error('❌ [AUTH] OTP verification error:', error)
      setMessage(error.message || 'Invalid code. Please try again.')
    } finally {
      setLoading(false)
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

  // Render single-page auth with both options
  if (authMethod === 'select') {
    return (
      <>
        <RoleSelectionModal
          isOpen={showRoleModal}
          userEmail={authenticatedEmail || email}
          termsAcceptedAt={new Date().toISOString()}
          inviteData={inviteData}
          preselectedRole={preselectedRole}
          onClose={() => setShowRoleModal(false)}
          onComplete={handleRoleModalComplete}
        />
      <div className="auth-page cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card-login">
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
            <div className="space-y-4 mb-6">
              <div className="flex space-x-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="cosmic-input w-[25px] text-sm"
                  disabled={loading}
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
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="cosmic-input flex-1"
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>

              <button
                onClick={handleWhatsAppSubmit}
                className="cosmic-button-primary w-full py-4 text-lg"
                disabled={loading || !phoneNumber}
              >
                {loading ? (
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
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-400"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 text-gray-400">OR</span>
              </div>
            </div>

            {/* Email Section */}
            <div className="space-y-4">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="cosmic-input"
                disabled={loading}
                autoComplete="email"
              />

              <button
                onClick={handleEmailSubmit}
                className="cosmic-button-primary w-full py-4 text-lg"
                disabled={loading || !email}
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    <span>Sending...</span>
                  </span>
                ) : (
                  'Continue with Email'
                )}
              </button>
            </div>

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
            <p className="text-center text-xs text-gray-400 mt-8">
              By continuing, you agree to DECODE's<br />
              <a href="https://welovedecode.com/#terms" className="text-purple-400 hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="https://welovedecode.com/#privacy" className="text-purple-400 hover:underline">Privacy Policy</a>
              <span className="text-gray-400">.</span>
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
        <div className="auth-page cosmic-bg">
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
                <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
                <p className="text-gray-400">
                  We sent a magic link to <span className="text-white font-medium">{email}</span>
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="cosmic-button-secondary w-full"
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend magic link'}
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
      <div className="auth-page cosmic-bg">
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
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                className="cosmic-button-primary w-full py-3"
                disabled={loading || !email}
              >
                {loading ? (
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
        <div className="auth-page cosmic-bg">
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
                    disabled={loading}
                  />
                ))}
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleOTPVerify}
                  className="cosmic-button-primary w-full py-3"
                  disabled={loading || otpCode.join('').length !== 6}
                >
                  {loading ? (
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
                  disabled={resendCooldown > 0 || loading}
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
      <div className="auth-page cosmic-bg">
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
                  disabled={loading}
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
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="cosmic-input flex-1"
                  required
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>

              <button
                type="submit"
                className="cosmic-button-primary w-full py-3"
                disabled={loading || !phoneNumber}
              >
                {loading ? (
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
  return (
    <>
      <div className="auth-page cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>

      {/* Role Selection Modal */}
      <RoleSelectionModal
        isOpen={showRoleModal}
        userEmail={authenticatedEmail || email}
        termsAcceptedAt={new Date().toISOString()}
        inviteData={inviteData}
        preselectedRole={preselectedRole}
        onClose={() => setShowRoleModal(false)}
        onComplete={handleRoleModalComplete}
      />
    </>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="auth-page cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  )
}
