'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    // Validate role selection for signup
    if (!isLogin && !role) {
      setMessage('Please select your role')
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
        setMessage('Check your email to confirm your account!')
        console.log('User signed up:', data.user)
      }
    } catch (error) {
      setMessage((error as Error).message || 'An error occurred')
      console.error('Auth error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="cosmic-card-login">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="DECODE" className="mx-auto mb-2" style={{height: '40px', filter: 'brightness(0) invert(1)'}} />
            <p className="cosmic-body opacity-70">Making Girls More Beautiful</p>
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
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cosmic-input"
                required
                disabled={loading}
              />
            </div>
            
            {!isLogin && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  Select your role
                </label>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg border border-gray-700 hover:border-purple-500 transition-colors">
                    <input
                      type="radio"
                      name="role"
                      value="Beauty Professional"
                      checked={role === 'Beauty Professional'}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-4 h-4 text-purple-500 bg-gray-800 border-gray-600 focus:ring-purple-500 focus:ring-2"
                      disabled={loading}
                    />
                    <div className="flex-1">
                      <div className="text-white font-medium">Beauty Professional</div>
                      <div className="text-gray-400 text-xs">Create payment links for your services</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg border border-gray-700 hover:border-purple-500 transition-colors">
                    <input
                      type="radio"
                      name="role"
                      value="Beauty Model"
                      checked={role === 'Beauty Model'}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-4 h-4 text-purple-500 bg-gray-800 border-gray-600 focus:ring-purple-500 focus:ring-2"
                      disabled={loading}
                    />
                    <div className="flex-1">
                      <div className="text-white font-medium">Beauty Model</div>
                      <div className="text-gray-400 text-xs">Receive payments through linked accounts</div>
                    </div>
                  </label>
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="cosmic-button-primary w-full"
            >
              {loading ? 'Loading...' : (isLogin ? 'Login' : 'Sign up')}
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
                {isLogin ? "Don't have an account? Register" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}