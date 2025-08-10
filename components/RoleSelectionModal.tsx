'use client'

// Force cache clear for TypeScript fix
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface RoleSelectionModalProps {
  isOpen: boolean
  userEmail: string
  userId?: string  // User ID passed from signup
  termsAcceptedAt: string
  onClose: () => void
  onComplete: () => void
}

export default function RoleSelectionModal({ isOpen, userEmail, userId, termsAcceptedAt, onClose, onComplete }: RoleSelectionModalProps) {
  const [role, setRole] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    const fetchCompanySuggestions = async () => {
      if (companyName.length >= 3) {
        try {
          const response = await fetch(`/api/companies/suggestions?q=${encodeURIComponent(companyName)}`)
          const data = await response.json()
          if (data.suggestions) {
            setCompanySuggestions(data.suggestions)
            setShowSuggestions(data.suggestions.length > 0)
          }
        } catch (error) {
          console.error('Error fetching company suggestions:', error)
        }
      } else {
        setShowSuggestions(false)
        setCompanySuggestions([])
      }
    }

    const debounceTimer = setTimeout(fetchCompanySuggestions, 300)
    return () => clearTimeout(debounceTimer)
  }, [companyName])

  const handleCompanySelect = (selectedCompany: string) => {
    setCompanyName(selectedCompany)
    setShowSuggestions(false)
    setCompanySuggestions([])
  }

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
    
    // Additional validation to ensure company name is not just spaces
    if (companyName.trim().length < 2) {
      setMessage('Company name must be at least 2 characters long')
      return
    }
    
    if (!userName.trim()) {
      setMessage('Please enter your name')
      return
    }

    setLoading(true)
    setMessage('')
    
    try {
      // Use the userId passed from signup, or try to get from session as fallback
      let userIdToUse = userId
      
      if (!userIdToUse) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('Unable to get user information. Please try logging in again.')
        }
        userIdToUse = user.id
      }

      const { error } = await supabase
        .from('users')
        .insert({
          id: userIdToUse,
          email: userEmail,
          user_name: userName.trim(),
          role: role,
          company_name: companyName.trim(),
          branch_name: null,  // No branch assignment during registration - admin will assign later
          approval_status: role === 'Admin' ? 'approved' : 'pending',
          terms_accepted_at: termsAcceptedAt
        })

      if (error) throw error

      onComplete()
    } catch (error) {
      console.error('Profile creation error:', error)
      
      // Handle specific database errors
      const errorMessage = (error as any)?.message || 'An error occurred'
      const errorCode = (error as any)?.code
      
      if (errorMessage.includes('company_name') && errorMessage.includes('null')) {
        setMessage('Company name is required and cannot be empty')
      } else if (errorMessage.includes('email') && errorMessage.includes('duplicate')) {
        setMessage('This email is already registered')
      } else if (errorCode === '23505') {
        setMessage('A user with this email already exists')
      } else if (errorCode === '42501') {
        setMessage('Permission denied. Please try again or contact support.')
      } else {
        setMessage(`Registration failed: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center px-4 z-50">
      <div className="cosmic-card-login max-w-md w-full">
        <div className="text-center mb-12">
          <h2 className="cosmic-heading text-xl mb-2">Complete Your Profile</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Company
            </label>
            <input
              type="text"
              placeholder="Enter company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onFocus={() => setShowSuggestions(companySuggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="cosmic-input"
              required
              disabled={loading}
              autoComplete="off"
            />
            
            {showSuggestions && companySuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg mt-1 z-10 max-h-32 overflow-y-auto">
                {companySuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    className="w-full text-left px-4 py-2 text-white hover:bg-purple-600 transition-colors first:rounded-t-lg last:rounded-b-lg"
                    onClick={() => handleCompanySelect(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Name
            </label>
            <input
              type="text"
              placeholder="Enter your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
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
              <label className={`flex items-center space-x-3 cursor-pointer p-3 rounded-lg border transition-colors ${
                role === 'Admin' 
                  ? 'border-purple-500 bg-purple-500/10' 
                  : 'border-gray-700 hover:border-purple-500'
              }`}>
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
                  <div className="text-gray-300 text-xs">Manage company data and approve users</div>
                </div>
              </label>
              
              <label className={`flex items-center space-x-3 cursor-pointer p-3 rounded-lg border transition-colors ${
                role === 'User' 
                  ? 'border-purple-500 bg-purple-500/10' 
                  : 'border-gray-700 hover:border-purple-500'
              }`}>
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
                  <div className="text-gray-300 text-xs">Access features and use service</div>
                </div>
              </label>
            </div>
          </div>

          {message && (
            <div className="text-center p-3 rounded-lg text-sm text-red-300 bg-red-900/20">
              {message}
            </div>
          )}

          <div className="space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="cosmic-button-primary w-full"
            >
              {loading ? 'Creating...' : 'Register'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="cosmic-button-secondary w-full text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}