'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

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
        setMessage('Login successful!')
        console.log('User logged in:', data.user)
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
        <div className="cosmic-card">
          <div className="text-center mb-8">
            <Link href="/" className="cosmic-logo hover:opacity-80 transition-opacity">
              DECODE
            </Link>
            <p className="cosmic-body mt-2 opacity-80">Beauty Payment Platform</p>
          </div>
          
          <div className="flex mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 px-4 font-medium transition-all duration-200 ${
                isLogin 
                  ? 'bg-gradient-to-r from-orange-400 to-pink-400 text-white rounded-l-lg' 
                  : 'bg-white/10 text-white/70 hover:bg-white/20 rounded-l-lg'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 px-4 font-medium transition-all duration-200 ${
                !isLogin 
                  ? 'bg-gradient-to-r from-orange-400 to-pink-400 text-white rounded-r-lg' 
                  : 'bg-white/10 text-white/70 hover:bg-white/20 rounded-r-lg'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
            <button
              type="submit"
              disabled={loading}
              className="cosmic-button-primary"
            >
              {loading ? 'Loading...' : (isLogin ? 'Login' : 'Sign Up')}
            </button>
            {message && (
              <div className={`text-center p-3 rounded-lg border ${
                message.includes('error') || message.includes('Error') 
                  ? 'bg-red-900/20 border-red-500/30 text-red-200' 
                  : 'bg-green-900/20 border-green-500/30 text-green-200'
              }`}>
                {message}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}