'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import RoleSelectionModal from '@/components/RoleSelectionModal'
import PasswordInput from '@/components/PasswordInput'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(true)
  const [emailError, setEmailError] = useState('')
  const [checkingEmail, setCheckingEmail] = useState(false)

  // Real-time email validation
  useEffect(() => {
    const checkEmailExists = async () => {
      if (!isLogin && email && email.includes('@')) {
        setCheckingEmail(true)
        try {
          const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`)
          const data = await response.json()
          
          if (data.exists) {
            setEmailError('This email is already registered')
          } else {
            setEmailError('')
          }
        } catch (error) {
          console.error('Error checking email:', error)
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
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
        console.log('User logged in:', data.user)
        window.location.href = '/dashboard'
        return // Don't set loading to false for login - let redirect happen
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        })
        if (error) throw error
        
        if (data.user) {
          setShowRoleModal(true)
        } else {
          setMessage('Check your email to confirm your account!')
        }
        console.log('User signed up:', data.user)
      }
    } catch (error) {
      setMessage((error as Error).message || 'An error occurred')
      console.error('Auth error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleModalClose = () => {
    setShowRoleModal(false)
    setMessage('Check your email to confirm your account!')
  }

  const handleRoleModalComplete = () => {
    setShowRoleModal(false)
    window.location.href = '/dashboard'
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
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="auth-terms-agreement"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 mt-1 text-purple-500 bg-gray-800 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                  disabled={loading}
                />
                <label htmlFor="auth-terms-agreement" className="text-xs text-gray-300 leading-relaxed">
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
              {loading ? 'Loading...' : (isLogin ? 'Login' : 'Register')}
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
        termsAcceptedAt={new Date().toISOString()}
        onClose={handleRoleModalClose}
        onComplete={handleRoleModalComplete}
      />
    </div>
  )
}