'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface RoleSelectionModalProps {
  isOpen: boolean
  userEmail: string
  onClose: () => void
  onComplete: () => void
}

export default function RoleSelectionModal({ isOpen, userEmail, onClose, onComplete }: RoleSelectionModalProps) {
  const [role, setRole] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!role) {
      setMessage('Please select your role')
      return
    }
    
    if (!companyName.trim()) {
      setMessage('Please enter your company name')
      return
    }

    setLoading(true)
    setMessage('')
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not found')
      }

      const { error } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: userEmail,
          full_name: '',
          role: role,
          company_name: companyName.trim()
        })

      if (error) throw error

      onComplete()
    } catch (error) {
      setMessage((error as Error).message || 'An error occurred')
      console.error('Profile creation error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 z-50">
      <div className="cosmic-card-login max-w-md w-full">
        <div className="text-center mb-6">
          <h2 className="cosmic-heading text-xl mb-2">Complete Your Profile</h2>
          <p className="cosmic-body opacity-70">Choose your role and company details</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Company Name
            </label>
            <input
              type="text"
              placeholder="Enter your company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="cosmic-input"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              Select your role
            </label>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg border border-gray-700 hover:border-purple-500 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="Admin"
                  checked={role === 'Admin'}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-4 h-4 text-purple-500 bg-gray-800 border-gray-600 focus:ring-purple-500 focus:ring-2"
                  disabled={loading}
                />
                <div className="flex-1">
                  <div className="text-white font-medium">Admin</div>
                  <div className="text-gray-400 text-xs">Manage company users and approve signups</div>
                </div>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg border border-gray-700 hover:border-purple-500 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="User"
                  checked={role === 'User'}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-4 h-4 text-purple-500 bg-gray-800 border-gray-600 focus:ring-purple-500 focus:ring-2"
                  disabled={loading}
                />
                <div className="flex-1">
                  <div className="text-white font-medium">User</div>
                  <div className="text-gray-400 text-xs">Access company features and services</div>
                </div>
              </label>
            </div>
          </div>

          {message && (
            <div className="text-center p-3 rounded-lg text-sm text-red-300 bg-red-900/20">
              {message}
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="cosmic-button-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="cosmic-button-primary flex-1"
            >
              {loading ? 'Creating...' : 'Complete Setup'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}