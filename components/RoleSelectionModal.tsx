'use client'

// Force cache clear for TypeScript fix
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface RoleSelectionModalProps {
  isOpen: boolean
  userEmail: string
  userId?: string  // User ID passed from signup
  termsAcceptedAt: string
  inviteData?: any  // Invite data for pre-population
  onClose: () => void
  onComplete: () => void
}

export default function RoleSelectionModal({ isOpen, userEmail, userId, termsAcceptedAt, inviteData, onClose, onComplete }: RoleSelectionModalProps) {
  const [role, setRole] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [hasSelectedSuggestion, setHasSelectedSuggestion] = useState(false)
  
  const supabase = createClient()

  // Pre-populate form with invite data
  useEffect(() => {
    if (inviteData) {
      setRole(inviteData.role || '')
      setCompanyName(inviteData.companyName || '')
      setHasSelectedSuggestion(true) // Prevent company suggestions for invited users
    }
  }, [inviteData])

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
      console.log('🔄 [ROLE MODAL] Starting profile creation...')
      console.log('🔄 [ROLE MODAL] User ID provided:', userId)
      console.log('🔄 [ROLE MODAL] Email:', userEmail)
      console.log('🔄 [ROLE MODAL] Role:', role)
      console.log('🔄 [ROLE MODAL] Company:', companyName.trim())
      console.log('🔄 [ROLE MODAL] Has invite data:', !!inviteData)
      
      // Use the userId passed from signup, or try to get from session as fallback
      let userIdToUse = userId
      let authUser = null
      
      if (!userIdToUse) {
        console.log('🔄 [ROLE MODAL] No userId provided, trying to get from session...')
        
        // Try multiple approaches to get user ID
        const getUserAttempts = [
          // Attempt 1: Direct getUser with short timeout
          async () => {
            console.log('🔄 [ROLE MODAL] Attempt 1: Direct getUser...')
            const { data, error } = await Promise.race([
              supabase.auth.getUser(),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 2000)
              )
            ])
            
            if (!error && data?.user) {
              console.log('✅ [ROLE MODAL] Got user from direct getUser:', data.user.id)
              return data.user
            }
            throw error || new Error('No user from direct getUser')
          },
          
          // Attempt 2: Get from existing session
          async () => {
            console.log('🔄 [ROLE MODAL] Attempt 2: Get from session...')
            const { data: sessionData } = await supabase.auth.getSession()
            if (sessionData.session?.user) {
              console.log('✅ [ROLE MODAL] Got user from session:', sessionData.session.user.id)
              return sessionData.session.user
            }
            throw new Error('No user in session')
          },
          
          // Attempt 3: Proxy user route (if we have session token)
          async () => {
            console.log('🔄 [ROLE MODAL] Attempt 3: Proxy user route...')
            const { data: sessionData } = await supabase.auth.getSession()
            
            if (!sessionData.session?.access_token) {
              throw new Error('No access token for proxy request')
            }
            
            const proxyResponse = await fetch('/api/auth/proxy-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ access_token: sessionData.session.access_token })
            })
            
            const proxyData = await proxyResponse.json()
            
            if (proxyResponse.ok && proxyData.success && proxyData.user) {
              console.log('✅ [ROLE MODAL] Got user from proxy:', proxyData.user.id)
              return proxyData.user
            }
            throw new Error(proxyData.error || 'Proxy user request failed')
          }
        ]
        
        // Try each method in sequence
        for (let i = 0; i < getUserAttempts.length; i++) {
          try {
            authUser = await getUserAttempts[i]()
            userIdToUse = authUser.id
            break
          } catch (error: any) {
            console.log(`⚠️ [ROLE MODAL] User retrieval attempt ${i + 1} failed:`, error.message)
            if (i === getUserAttempts.length - 1) {
              console.log('⚠️ [ROLE MODAL] All user retrieval attempts failed - will use email-based profile creation')
              userIdToUse = null
            }
          }
        }
        
        console.log('🔍 [ROLE MODAL] Final user ID determination:', {
          userIdToUse,
          hasAuthUser: !!authUser,
          willUseEmailBased: !userIdToUse
        })
      }

      // Create profile data with improved error handling
      console.log('🔄 [ROLE MODAL] Preparing profile data...')
      
      let profileData: any
      let insertMethod = 'with-user-id'
      
      if (userIdToUse) {
        // Standard case: we have a user ID from auth
        console.log('✅ [ROLE MODAL] Creating profile with user ID:', userIdToUse)
        profileData = {
          id: userIdToUse,
          email: userEmail,
          user_name: userName.trim(),
          role: role,
          company_name: companyName.trim(),
          branch_name: role === 'Admin' ? 'Main Branch' : null,
          approval_status: (role === 'Admin' || inviteData) ? 'approved' : 'pending',
          terms_accepted_at: termsAcceptedAt
        }
      } else {
        // Fallback: create profile without user ID and let the database RLS handle it
        console.log('⚠️ [ROLE MODAL] Creating profile using email-based method for:', userEmail)
        insertMethod = 'email-based'
        
        // Try to get user ID from auth via proxy
        try {
          console.log('🔄 [ROLE MODAL] Attempting to find user ID via proxy...')
          const proxyResponse = await fetch('/api/auth/proxy-user-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
          })
          
          const proxyData = await proxyResponse.json()
          
          if (proxyResponse.ok && proxyData.success && proxyData.userId) {
            console.log('✅ [ROLE MODAL] Found user ID via proxy:', proxyData.userId)
            profileData = {
              id: proxyData.userId,
              email: userEmail,
              user_name: userName.trim(),
              role: role,
              company_name: companyName.trim(),
              branch_name: role === 'Admin' ? 'Main Branch' : null,
              approval_status: (role === 'Admin' || inviteData) ? 'approved' : 'pending',
              terms_accepted_at: termsAcceptedAt
            }
            insertMethod = 'found-by-proxy'
          } else {
            throw new Error('Proxy lookup failed')
          }
        } catch (proxyError) {
          // Last resort: create without ID - database will handle auth.uid() lookup
          console.log('⚠️ [ROLE MODAL] Proxy lookup failed, using email-only profile creation')
          profileData = {
            email: userEmail,
            user_name: userName.trim(),
            role: role,
            company_name: companyName.trim(),
            branch_name: role === 'Admin' ? 'Main Branch' : null,
            approval_status: (role === 'Admin' || inviteData) ? 'approved' : 'pending',
            terms_accepted_at: termsAcceptedAt
          }
        }
      }
      
      console.log('🔄 [ROLE MODAL] Profile creation details:', {
        method: insertMethod,
        hasId: !!profileData.id,
        email: profileData.email,
        role: profileData.role,
        company: profileData.company_name
      })

      // Attempt profile insertion with timeout and retry
      let insertError: any = null
      const maxRetries = 3
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 [ROLE MODAL] Profile insert attempt ${attempt}/${maxRetries}`)
          
          const { error } = await Promise.race([
            supabase.from('users').insert(profileData),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error(`Database timeout on attempt ${attempt}`)), 8000)
            )
          ])
          
          if (error) {
            insertError = error
            console.error(`❌ [ROLE MODAL] Insert attempt ${attempt} failed:`, error)
            
            // If it's a duplicate key error and we don't have an ID, try to update instead
            if (error.code === '23505' && !profileData.id && attempt === 1) {
              console.log('🔄 [ROLE MODAL] Duplicate error - attempting update instead')
              const { error: updateError } = await supabase
                .from('users')
                .update({
                  user_name: userName.trim(),
                  role: role,
                  company_name: companyName.trim(),
                  branch_name: role === 'Admin' ? 'Main Branch' : null,
                  approval_status: (role === 'Admin' || inviteData) ? 'approved' : 'pending',
                  terms_accepted_at: termsAcceptedAt
                })
                .eq('email', userEmail)
              
              if (!updateError) {
                console.log('✅ [ROLE MODAL] Profile updated successfully instead of insert')
                break
              } else {
                console.error('❌ [ROLE MODAL] Update also failed:', updateError)
                insertError = updateError
              }
            }
            
            // Don't retry on certain errors
            if (error.code === '42501' || error.message?.includes('permission')) {
              console.log('❌ [ROLE MODAL] Permission error - not retrying')
              throw error
            }
            
            // Wait before retry (exponential backoff)
            if (attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000
              console.log(`⏳ [ROLE MODAL] Waiting ${delay}ms before retry...`)
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          } else {
            console.log('✅ [ROLE MODAL] Profile created successfully')
            insertError = null
            break
          }
        } catch (timeoutError: any) {
          console.error(`⏰ [ROLE MODAL] Timeout on attempt ${attempt}:`, timeoutError.message)
          insertError = timeoutError
          
          if (attempt === maxRetries) {
            throw new Error('Profile creation timed out after multiple attempts')
          }
        }
      }
      
      if (insertError) {
        console.error('❌ [ROLE MODAL] Final database error after all retries:', insertError)
        throw insertError
      }

      console.log('✅ [ROLE MODAL] Profile creation completed successfully')
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
              onChange={(e) => handleCompanyChange(e.target.value)}
              onFocus={() => !hasSelectedSuggestion && setShowSuggestions(companySuggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="cosmic-input"
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

          <div className="relative">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Name
            </label>
            <input
              type="text"
              placeholder="Enter your full name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="cosmic-input"
              required
              disabled={loading}
            />
          </div>


          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              {inviteData ? 'Your assigned role' : 'Select your role'}
            </label>
            {inviteData && (
              <p className="text-xs text-green-400">✓ Role assigned from invitation</p>
            )}
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
                  disabled={loading || !!inviteData}
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
                  disabled={loading || !!inviteData}
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