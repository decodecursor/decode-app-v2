'use client'

// Force cache clear for TypeScript fix
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

interface RoleSelectionModalProps {
  isOpen: boolean
  userEmail: string
  userId?: string  // User ID passed from signup
  termsAcceptedAt: string
  inviteData?: any  // Invite data for pre-population
  preselectedRole?: string | null  // Pre-selected role from URL
  onClose: () => void
  onComplete: (role: string) => void
}

export default function RoleSelectionModal({ isOpen, userEmail, userId, termsAcceptedAt, inviteData, preselectedRole, onClose, onComplete }: RoleSelectionModalProps) {
  console.log('🚀 [ROLE MODAL] Component initializing with props:', {
    isOpen,
    userEmail,
    userId,
    hasInviteData: !!inviteData,
    preselectedRole,
    inviteDataKeys: inviteData ? Object.keys(inviteData) : []
  })

  const [role, setRole] = useState(preselectedRole || inviteData?.role || '')
  const [companyName, setCompanyName] = useState(inviteData?.companyName || '')
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [hasSelectedSuggestion, setHasSelectedSuggestion] = useState(false)

  console.log('🚀 [ROLE MODAL] Initial state set:', {
    initialRole: role,
    initialCompanyName: companyName,
    fromInviteData: {
      role: inviteData?.role,
      companyName: inviteData?.companyName
    },
    fromPreselectedRole: preselectedRole
  })

  const nameInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Pre-populate form with invite data or pre-selected role
  useEffect(() => {
    console.log('🔄 [ROLE MODAL] Pre-population effect triggered')
    console.log('🔍 [ROLE MODAL] Props received:', {
      hasInviteData: !!inviteData,
      preselectedRole,
      userEmail,
      isOpen
    })
    console.log('🔍 [ROLE MODAL] Full inviteData structure:', JSON.stringify(inviteData, null, 2))

    if (inviteData) {
      console.log('✅ [ROLE MODAL] Processing invite data...')
      console.log('🔍 [ROLE MODAL] Available properties in inviteData:', Object.keys(inviteData))

      // Handle different possible role property names in invite data
      const inviteRole = inviteData.role || inviteData.user_role || inviteData.assignedRole || 'Staff'
      const inviteCompany = inviteData.companyName || inviteData.company_name || ''

      console.log('🔍 [ROLE MODAL] Extracted from invite data:', {
        role: inviteRole,
        company: inviteCompany,
        email: inviteData.email
      })

      setRole(inviteRole)
      setCompanyName(inviteCompany)
      setHasSelectedSuggestion(true) // Prevent company suggestions for invited users

      console.log('✅ [ROLE MODAL] Successfully applied invite data - Role:', inviteRole, 'Company:', inviteCompany)
    } else if (preselectedRole) {
      console.log('✅ [ROLE MODAL] Using preselected role:', preselectedRole)
      setRole(preselectedRole)
    } else {
      console.log('⚠️ [ROLE MODAL] No preselected role or invite data available')
      console.log('🔍 [ROLE MODAL] Current state - Role:', role, 'Company:', companyName)
    }
  }, [inviteData, preselectedRole])

  // Debug effect to track role changes
  useEffect(() => {
    console.log('🔄 [ROLE MODAL] Role state changed:', role)
  }, [role])

  // Debug effect to track company name changes
  useEffect(() => {
    console.log('🔄 [ROLE MODAL] Company name state changed:', companyName)
  }, [companyName])

  // Debug effect to track modal open/close state
  useEffect(() => {
    if (isOpen) {
      console.log('🎭 [ROLE MODAL] Modal opened with current state:', {
        role,
        companyName,
        userName,
        hasInviteData: !!inviteData,
        preselectedRole
      })
    } else {
      console.log('🎭 [ROLE MODAL] Modal closed')
    }
  }, [isOpen])

  // Auto-focus name input when modal opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      // Add a small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    const fetchCompanySuggestions = async () => {
      if (companyName.length >= 3 && !hasSelectedSuggestion) {
        try {
          const response = await fetch(`/api/companies/suggestions?q=${encodeURIComponent(companyName)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.suggestions) {
              setCompanySuggestions(data.suggestions)
              setShowSuggestions(data.suggestions.length > 0)
            }
          } else {
            // Don't show error for network issues, just hide suggestions
            setShowSuggestions(false)
            setCompanySuggestions([])
          }
        } catch (error) {
          // Network error - don't block user, just hide suggestions
          console.error('Error fetching company suggestions:', error)
          setShowSuggestions(false)
          setCompanySuggestions([])
        }
      } else {
        setShowSuggestions(false)
        setCompanySuggestions([])
      }
    }

    const debounceTimer = setTimeout(fetchCompanySuggestions, 300)
    return () => clearTimeout(debounceTimer)
  }, [companyName, hasSelectedSuggestion])

  const handleCompanySelect = (selectedCompany: string) => {
    setCompanyName(selectedCompany)
    setShowSuggestions(false)
    setCompanySuggestions([])
    setHasSelectedSuggestion(true)  // Mark that user has selected a suggestion
  }
  
  // Handle manual typing in company field
  const handleCompanyChange = (value: string) => {
    setCompanyName(value)
    // If user is manually editing, reset the selection flag
    if (hasSelectedSuggestion && value !== companyName) {
      setHasSelectedSuggestion(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!role) {
      setMessage('Please select your role')
      return
    }

    // Only validate company for non-Model roles
    if (role !== 'Model') {
      if (!companyName.trim()) {
        setMessage('Please enter your company name')
        return
      }

      // Additional validation to ensure company name is not just spaces
      if (companyName.trim().length < 2) {
        setMessage('Company name must be at least 2 characters long')
        return
      }
    }

    if (!userName.trim()) {
      setMessage('Please enter your name')
      return
    }

    setLoading(true)
    setMessage('')
    
    try {
      console.log('🔄 [ROLE MODAL] Starting profile creation...')
      console.log('🔄 [ROLE MODAL] User ID provided:', userId)
      console.log('🔄 [ROLE MODAL] Email:', userEmail)
      console.log('🔄 [ROLE MODAL] Role:', role)
      console.log('🔄 [ROLE MODAL] Company:', companyName.trim())
      console.log('🔄 [ROLE MODAL] Has invite data:', !!inviteData)
      
      // Use the userId passed from signup, or get from current session
      let userIdToUse = userId
      
      if (!userIdToUse) {
        console.log('🔄 [ROLE MODAL] No userId provided, trying to get from session...')
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            userIdToUse = user.id
            console.log('✅ [ROLE MODAL] Got user from session:', user.id)
          }
        } catch (error) {
          console.log('⚠️ [ROLE MODAL] Could not get user from session')
        }
      }

      // Check for existing branches in the company to auto-assign if only one exists
      let branchToAssign = role === 'Admin' ? 'Main Branch' : null

      if (role === 'Staff') {
        console.log('🔄 [ROLE MODAL] Checking company branches for auto-assignment...')
        try {
          // Query existing users in the company to get branches
          const { data: companyUsers, error: fetchError } = await supabase
            .from('users')
            .select('branch_name')
            .eq('company_name', companyName.trim())
            .eq('approval_status', 'approved')
            .not('branch_name', 'is', null)

          if (!fetchError && companyUsers) {
            // Extract unique branches
            const branches = new Set<string>()
            companyUsers.forEach(user => {
              if (user.branch_name) {
                // Handle comma-separated branches
                const userBranches = user.branch_name.split(',').map(b => b.trim()).filter(b => b !== '')
                userBranches.forEach(b => branches.add(b))
              }
            })

            console.log('🔍 [ROLE MODAL] Found branches:', Array.from(branches))

            // If only one branch exists and it's Main Branch, auto-assign to it
            if (branches.size === 1 && branches.has('Main Branch')) {
              branchToAssign = 'Main Branch'
              console.log('✅ [ROLE MODAL] Auto-assigning Staff user to Main Branch (only branch in company)')
            } else if (branches.size === 0) {
              // No branches exist yet, this might be the first Staff user
              // Check if an Admin exists with Main Branch
              const { data: adminUser } = await supabase
                .from('users')
                .select('branch_name')
                .eq('company_name', companyName.trim())
                .eq('role', 'Admin')
                .eq('approval_status', 'approved')
                .single()

              if (adminUser?.branch_name === 'Main Branch') {
                branchToAssign = 'Main Branch'
                console.log('✅ [ROLE MODAL] Auto-assigning Staff user to Main Branch (found via Admin)')
              }
            }
          }
        } catch (error) {
          console.log('⚠️ [ROLE MODAL] Could not fetch branches, proceeding without auto-assignment:', error)
        }
      }

      // Create profile data - simple approach
      const profileData = {
        id: userIdToUse,
        email: userEmail,
        user_name: userName.trim(),
        role: role,
        company_name: companyName.trim(),
        branch_name: branchToAssign,
        approval_status: (role === 'Admin' || role === 'Model' || inviteData) ? 'approved' : 'pending',
        terms_accepted_at: termsAcceptedAt
      }
      
      console.log('🔄 [ROLE MODAL] Creating profile:', profileData)

      let profileError = null
      
      // Try direct insert first
      try {
        console.log('🔄 [ROLE MODAL] Trying direct profile creation...')
        const { error } = await supabase.from('users').insert(profileData)
        
        if (error) {
          profileError = error
          throw error
        }
        
        console.log('✅ [ROLE MODAL] Direct profile creation successful')
      } catch (directError) {
        console.log('⚠️ [ROLE MODAL] Direct profile creation failed, trying proxy...', directError.message)
        
        // Try proxy profile creation
        try {
          console.log('🔄 [ROLE MODAL] Using proxy profile creation...')
          const proxyResponse = await fetch('/api/auth/create-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
          })
          
          const proxyData = await proxyResponse.json()
          
          if (!proxyResponse.ok || !proxyData.success) {
            throw new Error(proxyData.error || 'Proxy profile creation failed')
          }
          
          console.log('✅ [ROLE MODAL] Proxy profile creation successful')
        } catch (proxyError) {
          console.error('❌ [ROLE MODAL] Both direct and proxy profile creation failed')
          throw profileError || proxyError
        }
      }
      onComplete(role)
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
          {role !== 'Model' && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Company
              </label>
              <input
                type="text"
                placeholder="Enter company name"
                value={companyName}
                onChange={(e) => handleCompanyChange(e.target.value)}
                onFocus={() => !hasSelectedSuggestion && setShowSuggestions(companySuggestions.length > 0)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className={`cosmic-input border-purple-500 ${companyName.trim() ? 'has-content bg-slate-800' : ''} ${inviteData && companyName ? 'bg-slate-800' : ''}`}
                required
                disabled={loading || !!inviteData}
                autoComplete="off"
              />
              {inviteData && (
                <p className="text-xs text-green-400 mt-1">✓ Pre-filled from invitation</p>
              )}

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
          )}

          <div className="relative">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              placeholder="Enter your full name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className={`cosmic-input border-purple-500 ${userName.trim() ? 'has-content bg-slate-800' : ''}`}
              required
              disabled={loading}
            />
          </div>


          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              {inviteData ? 'Your assigned role' :
               preselectedRole ? 'Your role' :
               'Select your role'}
            </label>
            {(inviteData || preselectedRole) && (
              <p className="text-xs text-green-400">
                ✓ {inviteData ? 'Role assigned from invitation' : 'Pre-selected role'}
              </p>
            )}
            <div className="space-y-3">
              <label className={`flex items-center space-x-3 cursor-pointer p-3 rounded-lg border transition-colors ${
                role === 'Admin'
                  ? 'border-purple-500 bg-slate-800'
                  : 'border-gray-700 hover:border-purple-500'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="Admin"
                  checked={role === 'Admin'}
                  onChange={(e) => setRole(e.target.value)}
                  className={`role-radio w-4 h-4 bg-gray-800 border-gray-600 focus:ring-purple-500 focus:ring-2 ${
                    role === 'Admin' ? 'accent-purple-500 border-purple-500' : 'accent-purple-500'
                  }`}
                  disabled={loading || !!inviteData || !!preselectedRole}
                />
                <div className="flex-1">
                  <div className="text-white font-medium">Admin</div>
                  <div className="text-gray-300 text-xs">Manage bank accounts and approve staff</div>
                </div>
              </label>

              <label className={`flex items-center space-x-3 cursor-pointer p-3 rounded-lg border transition-colors ${
                role === 'Staff'
                  ? 'border-purple-500 bg-slate-800'
                  : 'border-gray-700 hover:border-purple-500'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="Staff"
                  checked={role === 'Staff'}
                  onChange={(e) => setRole(e.target.value)}
                  className={`role-radio w-4 h-4 bg-gray-800 border-gray-600 focus:ring-purple-500 focus:ring-2 ${
                    role === 'Staff' ? 'accent-purple-500 border-purple-500' : 'accent-purple-500'
                  }`}
                  disabled={loading || !!inviteData || !!preselectedRole}
                />
                <div className="flex-1">
                  <div className="text-white font-medium">Staff</div>
                  <div className="text-gray-300 text-xs">Create payment links</div>
                </div>
              </label>

              <label className={`flex items-center space-x-3 cursor-pointer p-3 rounded-lg border transition-colors ${
                role === 'Model'
                  ? 'border-purple-500 bg-slate-800'
                  : 'border-gray-700 hover:border-purple-500'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="Model"
                  checked={role === 'Model'}
                  onChange={(e) => setRole(e.target.value)}
                  className={`role-radio w-4 h-4 bg-gray-800 border-gray-600 focus:ring-purple-500 focus:ring-2 ${
                    role === 'Model' ? 'accent-purple-500 border-purple-500' : 'accent-purple-500'
                  }`}
                  disabled={loading || !!inviteData || !!preselectedRole}
                />
                <div className="flex-1">
                  <div className="text-white font-medium">Model</div>
                  <div className="text-gray-300 text-xs">Create beauty service auctions and refer beauty businesses</div>
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