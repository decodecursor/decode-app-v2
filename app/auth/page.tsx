'use client'

import { useState } from 'react'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    
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
          <div className="text-center mb-8">
            <img src="/logo.png" alt="DECODE" className="mx-auto mb-2" style={{height: '40px', filter: 'brightness(0) invert(1)'}} />
            <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="cosmic-input"
                required
                disabled={loading}
              />
            </div>
            <div>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Password"
                required
                disabled={loading}
              />
            </div>
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
            
            <div className="text-center pt-4">
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
        onClose={handleRoleModalClose}
        onComplete={handleRoleModalComplete}
      />
    </div>
  )
}