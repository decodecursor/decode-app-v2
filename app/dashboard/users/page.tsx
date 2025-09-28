'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
import { validateUserProfile, USER_ROLES } from '@/types/user'
import Link from 'next/link'

// Numbered Avatar Component
const NumberedAvatar = ({ number, size = 'sm' }: { 
  number: number
  size?: 'sm' | 'md' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm'
  }
  
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {number}
    </div>
  )
}

interface User {
  id: string
  email: string
  user_name: string
  company_name: string
  branch_name: string | null
  role: string
  approval_status: string
  created_at: string
}

export default function UsersManagement() {
  const supabase = createClient()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [adminCompany, setAdminCompany] = useState<string>('')
  const [companyProfileImage, setCompanyProfileImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [showDeleteBranchModal, setShowDeleteBranchModal] = useState(false)
  const [branchToDelete, setBranchToDelete] = useState('')
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [branchToRemoveFrom, setBranchToRemoveFrom] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string[]>>({})
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Staff')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [inviteMessage, setInviteMessage] = useState('')
  const [newUserCount, setNewUserCount] = useState(0)
  const [lastCheckedTime, setLastCheckedTime] = useState<Date>(new Date())

  // Function to reset new user notifications
  const resetNewUserNotifications = () => {
    setNewUserCount(0)
    setLastCheckedTime(new Date())
  }

  useEffect(() => {
    const loadUsers = async () => {
      try {
        // Get current admin user
        const { user } = await getUserWithProxy()
        console.log('🔍 Users page - getUserWithProxy result:', user?.id)
        if (!user) {
          console.log('❌ No user from getUserWithProxy, redirecting to /auth')
          setLoading(false)
          router.push('/auth')
          return
        }

        // Get admin's profile using the SAME proxy endpoint as dashboard
        console.log('🔍 Attempting to fetch user profile...')
        const response = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include'
        })

        console.log('🔍 Response status:', response.status)
        if (!response.ok) {
          console.error('❌ Failed to fetch user profile, status:', response.status)
          const errorText = await response.text()
          console.error('❌ Error response:', errorText)
          setLoading(false)
          router.push('/dashboard')
          return
        }

        const { userData } = await response.json()
        console.log('🔍 Admin data:', userData)
        console.log('🔍 Role check - userData.role:', userData?.role)

        // Use validateUserProfile like dashboard does - this ensures role is never null
        const validatedProfile = validateUserProfile(userData)
        console.log('🔍 Validated role:', validatedProfile.role)

        if (!userData || validatedProfile.role !== USER_ROLES.ADMIN) {
          console.log('❌ Not admin, redirecting to /dashboard')
          console.log('Role value:', userData?.role)
          console.log('Validated role:', validatedProfile.role)
          console.log('Expected:', USER_ROLES.ADMIN)
          setLoading(false)
          router.push('/dashboard')
          return
        }

        console.log('🔍 Setting adminCompany to:', userData.company_name)
        setAdminCompany(userData.company_name)

        // TODO: Add profile_photo_url column to users table in database
        // For now, set to null - ProfileImage component will show user initials
        setCompanyProfileImage(null)

        // Get company users and branches via proxy endpoint
        console.log('🔍 Fetching company data via proxy...')
        const companyResponse = await fetch('/api/users/company', {
          method: 'GET',
          credentials: 'include'
        })

        console.log('🔍 Company response status:', companyResponse.status)
        if (!companyResponse.ok) {
          const errorData = await companyResponse.json()
          console.error('❌ Failed to fetch company data:', errorData.error)
          setLoading(false)
          return
        }

        const { users: companyUsers, branches: branchNames } = await companyResponse.json()
        console.log('🔍 Fetched users:', companyUsers?.length, 'branches:', branchNames?.length)
        setUsers(companyUsers || [])
        setBranches(branchNames || [])
        setLoading(false)

      } catch (error) {
        console.error('Error loading users:', error)
        setLoading(false)
      }
    }

    loadUsers()
  }, [router, supabase])

  // REAL-TIME SUBSCRIPTION TEMPORARILY DISABLED FOR STABILITY
  // Users will need to refresh page to see new users

  const handleApproval = async (userId: string, action: 'approved' | 'rejected') => {
    try {
      const { user } = await getUserWithProxy()
      if (!user) return

      // Get pending branch assignments for this user
      const assignedBranches = pendingAssignments[userId] || []
      
      // Prepare update data
      const updateData: any = {
        approval_status: action,
        approved_by: user.id,
        approved_at: new Date().toISOString()
      }
      
      // If approving, also assign the selected branches
      if (action === 'approved' && assignedBranches.length > 0) {
        updateData.branch_name = assignedBranches.join(',')
      } else if (action === 'approved' && assignedBranches.length === 0) {
        // If approving without branch selection, assign to first available branch or null if no branches exist
        updateData.branch_name = branches.length > 0 ? branches[0] : null
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)

      if (error) throw error

      // Update local state immediately
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === userId 
            ? { ...u, ...updateData }
            : u
        )
      )
      
      // Clear pending assignments for this user after approval/rejection
      setPendingAssignments(prev => {
        const newAssignments = { ...prev }
        delete newAssignments[userId]
        return newAssignments
      })

      // No success message needed

    } catch (error) {
      console.error('Error updating user:', error)
      setMessage('Failed to update user status')
    }
  }

  const handleCreateBranch = async () => {
    console.log('🔍 handleCreateBranch called')
    console.log('🔍 newBranchName:', newBranchName.trim())
    console.log('🔍 adminCompany:', adminCompany)

    if (!newBranchName.trim()) {
      console.log('❌ No branch name provided')
      setMessage('Please enter a branch name')
      return
    }

    if (!adminCompany) {
      console.log('❌ No admin company found')
      setMessage('Company information not found')
      return
    }

    try {
      console.log('🔍 Creating branch via proxy endpoint...')

      const response = await fetch('/api/branches/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newBranchName.trim(),
          company_name: adminCompany
        })
      })

      console.log('🔍 Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Branch creation failed:', errorData.error)

        if (response.status === 409) {
          setMessage('Branch already exists')
        } else {
          setMessage(`Failed to create branch: ${errorData.error}`)
        }
        return
      }

      const result = await response.json()
      console.log('✅ Branch created successfully:', result)

      // Update local state
      const updatedBranches = [...new Set([...branches, newBranchName.trim()])]
      setBranches(updatedBranches)

      setNewBranchName('')
      setShowCreateBranchModal(false)
    } catch (error: any) {
      console.error('❌ Error creating branch:', error)
      setMessage(error.message || 'Failed to create branch')
    }
  }

  const handleDeleteBranchClick = (branchName: string) => {
    setBranchToDelete(branchName)
    setShowDeleteBranchModal(true)
  }

  const handleDeleteBranch = async () => {
    if (!branchToDelete) return

    try {
      // Check if any users are in this branch (handle comma-separated branches)
      const usersInBranch = users.filter(u => {
        const userBranches = (u.branch_name || '').split(',').map(b => b.trim()).filter(b => b !== '')
        return userBranches.includes(branchToDelete)
      })

      if (usersInBranch.length > 0) {
        setMessage(`Cannot delete '${branchToDelete}' - ${usersInBranch.length} user(s) still assigned to this branch`)
        setTimeout(() => setMessage(''), 3000)
        setShowDeleteBranchModal(false)
        setBranchToDelete('')
        return
      }

      // Since branches are derived from user data, deleting a branch
      // just means removing it from local state (it's already gone if no users have it)
      const updatedBranches = branches.filter(b => b !== branchToDelete)
      setBranches(updatedBranches)

      setMessage(`Branch '${branchToDelete}' removed`)
      setTimeout(() => setMessage(''), 3000)
      setShowDeleteBranchModal(false)
      setBranchToDelete('')
    } catch (error) {
      console.error('Error deleting branch:', error)
      setMessage('Failed to delete branch')
      setShowDeleteBranchModal(false)
      setBranchToDelete('')
    }
  }

  const handleDeleteUserClick = (user: User, branch: string) => {
    setUserToDelete(user)
    setBranchToRemoveFrom(branch)
    setShowDeleteUserModal(true)
  }

  const handleDeleteUser = async () => {
    if (!userToDelete || !branchToRemoveFrom) return
    
    try {
      // Get current user's branches
      const currentBranches = (userToDelete.branch_name || '').split(',').map(b => b.trim()).filter(b => b !== '')
      
      // Remove the specific branch
      const remainingBranches = currentBranches.filter(b => b !== branchToRemoveFrom)
      
      // If no branches left, set to null (unassigned)
      const updatedBranchName = remainingBranches.length > 0 ? remainingBranches.join(',') : null
      
      const { error } = await supabase
        .from('users')
        .update({ branch_name: updatedBranchName })
        .eq('id', userToDelete.id)
      
      if (error) throw error
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userToDelete.id 
          ? { ...u, branch_name: updatedBranchName }
          : u
      ))
      
      setShowDeleteUserModal(false)
      setUserToDelete(null)
      setBranchToRemoveFrom('')
    } catch (error) {
      console.error('Error removing user from branch:', error)
      setMessage('Failed to remove user from branch')
      setShowDeleteUserModal(false)
      setUserToDelete(null)
      setBranchToRemoveFrom('')
    }
  }

  const handleAddUserToBranch = async (userId: string) => {
    if (!selectedBranch) return
    
    try {
      // Get current user's branches
      const currentUser = users.find(u => u.id === userId)
      if (!currentUser) return
      
      // Get current user's branches, properly handling null/empty
      const currentBranches = (currentUser.branch_name || '').split(',').map(b => b.trim()).filter(b => b !== '')
      
      // Check if user is already in this branch
      if (currentBranches.includes(selectedBranch)) {
        setShowAddUserModal(false)
        setSelectedBranch('')
        return
      }
      
      // Add new branch to existing branches
      const updatedBranches = [...currentBranches, selectedBranch].join(',')
      
      const { error } = await supabase
        .from('users')
        .update({ branch_name: updatedBranches })
        .eq('id', userId)
      
      if (error) throw error
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userId 
          ? { ...u, branch_name: updatedBranches }
          : u
      ))
      
      setShowAddUserModal(false)
      setSelectedBranch('')
    } catch (error) {
      console.error('Error adding user to branch:', error)
      setMessage('Failed to add user to branch')
    }
  }

  const handleUpdateUserBranches = async (userId: string, newBranchNames: string | null) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ branch_name: newBranchNames })
        .eq('id', userId)
      
      if (error) throw error
      
      // Update local state
      setUsers(users.map(u => 
        u.id === userId 
          ? { ...u, branch_name: newBranchNames }
          : u
      ))
      
      // No success message needed
      
    } catch (error) {
      console.error('Error updating user branches:', error)
      setMessage('Failed to update user branch assignment')
    }
  }

  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !adminCompany) return
    
    try {
      setInviteStatus('sending')
      setInviteLoading(true)
      
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          companyName: adminCompany
        }),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation')
      }

      // Success - show in-modal confirmation
      setInviteStatus('success')
      setInviteMessage('Invitation sent')
      
      // Auto-close modal after 5 seconds
      setTimeout(() => {
        setShowInviteModal(false)
        setInviteEmail('')
        setInviteRole('Staff')
        setShowRoleDropdown(false)
        setInviteStatus('idle')
        setInviteMessage('')
      }, 5000)
      
    } catch (error) {
      console.error('Error sending invitation:', error)
      
      // Map technical errors to user-friendly messages
      let userFriendlyMessage = 'Failed to send invitation. Please try again.'
      const errorMessage = error instanceof Error ? error.message : ''
      
      if (errorMessage.includes('Authentication required')) {
        userFriendlyMessage = 'Please refresh the page and try again.'
      } else if (errorMessage.includes('Admin access required')) {
        userFriendlyMessage = 'You need admin permissions to send invitations.'
      } else if (errorMessage.includes('already exists')) {
        userFriendlyMessage = 'This email is already registered in the system.'
      }
      
      setInviteStatus('error')
      setInviteMessage(userFriendlyMessage)
    } finally {
      setInviteLoading(false)
    }
  }


  const pendingUsers = users.filter(u => u.approval_status === 'pending')
  const approvedUsers = users.filter(u => u.approval_status === 'approved')
  const rejectedUsers = users.filter(u => u.approval_status === 'rejected')

  // Separate unassigned users - only show pending users who need branch assignment
  const unassignedUsers = users.filter(u => (!u.branch_name || u.branch_name.trim() === '') && u.approval_status === 'pending')
  const assignedUsers = users.filter(u => u.branch_name && u.branch_name.trim() !== '')

  // Group assigned users by branch - handle multi-branch users
  const usersByBranch = branches.reduce((acc, branch) => {
    acc[branch] = assignedUsers.filter(u => {
      const userBranches = (u.branch_name || '').split(',').map(b => b.trim())
      return userBranches.includes(branch)
    })
    return acc
  }, {} as Record<string, User[]>)

  return (
    <div className="cosmic-bg min-h-screen" onClick={resetNewUserNotifications}>
      <div className="min-h-screen px-4 py-8">
        {/* Back to Dashboard Link */}
        <div className="flex justify-center dashboard-back-button-spacing">
          <div className="w-full px-4 md:w-[70vw] md:px-0">
            <Link href="/dashboard" className="inline-flex items-center text-gray-300 hover:text-white transition-colors">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Header Card */}
        <div className="flex justify-center">
          <div className="w-full px-4 md:w-[70vw] md:px-0">
            <div className="cosmic-card header-card-mobile-spacing">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                  <h1 className="cosmic-heading mb-2 text-xl md:text-2xl">User Management</h1>
                </div>
                <div className="flex flex-row md:flex-row gap-1 md:gap-3">
                  <button
                    onClick={() => setShowCreateBranchModal(true)}
                    className="text-gray-300 hover:text-white hover:bg-white/10 rounded-lg text-[11px] md:text-[15px] font-medium px-1.5 py-2 md:px-4 md:py-2.5 cursor-pointer transition-colors flex-1 md:w-auto whitespace-nowrap user-header-create-branch-mobile"
                  >
                    Create Branch
                  </button>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="relative text-gray-300 hover:text-white hover:bg-white/10 rounded-lg text-[11px] md:text-[15px] font-medium px-1.5 py-2 md:px-4 md:py-2.5 cursor-pointer transition-colors flex-1 md:w-auto whitespace-nowrap user-header-invite-user-mobile"
                  >
                    Invite User
                    {newUserCount > 0 && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                        {newUserCount > 9 ? '9+' : newUserCount}
                      </div>
                    )}
                  </button>
                  <Link
                    href="/payment/create"
                    className="bg-gradient-to-br from-gray-800 to-black text-white border-none rounded-lg text-[11px] md:text-[15px] font-medium px-1.5 py-3 md:px-5 md:py-3 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-gray-600 hover:to-gray-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] inline-block text-center flex-1 md:w-auto whitespace-nowrap"
                  >
                    Create PayLink
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div className="flex justify-center mb-6">
            <div className="w-full px-4 md:w-[70vw] md:px-0">
              <div className={`p-3 md:p-2 rounded-lg text-sm md:text-sm ${message.includes('Failed') ? 'bg-red-900/20 text-red-300' : 'bg-green-900/10 text-green-400 border border-green-500/20'}`}>
                {message}
              </div>
            </div>
          </div>
        )}


        <div className="flex justify-center">
          <div className="w-full px-4 md:w-[70vw] md:px-0">
            <div className="space-y-6">
              {/* Unassigned Users Section */}
              {unassignedUsers.length > 0 && (
                <div className="cosmic-card w-full md:w-1/2 mx-auto mb-6 border-2 border-red-500 !bg-red-800 shadow-lg shadow-red-500/30 ring-2 ring-red-400/40 relative z-10 overflow-visible">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-4">
                    <h3 className="text-lg md:text-xl font-semibold text-white">
                      New User(s)
                    </h3>
                    <div className="text-sm md:text-base font-semibold text-yellow-400 bg-yellow-400/10 px-3 py-2 md:py-1 rounded-lg border border-yellow-400/30">
                      ⚠️ Awaiting branch assignment
                    </div>
                  </div>

                  <div className="space-y-4 md:space-y-3 bg-black/20 rounded-lg p-4 border-l-4 border-red-500 shadow-inner">
                    {unassignedUsers.map((user, index) => (
                      <div key={user.id} className="flex flex-col md:flex-row md:items-center gap-4 md:gap-3 p-4 md:p-3 bg-gray-800/30 hover:bg-gray-700/50 rounded-lg border border-gray-700/50 transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <NumberedAvatar
                            number={index + 1}
                            size="md"
                          />
                          <div className="text-gray-300">
                            <div className="font-medium text-base md:text-sm">{user.user_name}</div>
                            <div className="text-sm md:text-xs text-gray-400 mt-1">
                              <span className="text-purple-400 font-semibold">{user.role}</span>
                              <span className="mx-2">•</span>
                              <span>{user.email}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-3 w-full md:w-auto">
                          <span className={`px-3 py-2 md:py-1 rounded-full text-xs font-medium text-center md:text-left ${
                            user.approval_status === 'approved'
                              ? 'bg-green-900/20 text-green-400'
                              : user.approval_status === 'rejected'
                              ? 'bg-red-900/20 text-red-400'
                              : 'bg-yellow-900/20 text-yellow-400'
                          }`}>
                            {user.approval_status === 'approved' ? 'Active' : user.approval_status}
                          </span>

                          {/* Multi-Branch Assignment Interface */}
                          <div className="relative w-full md:w-auto">
                            <details className="relative">
                              <summary className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-4 py-3 md:px-3 md:py-1.5 cursor-pointer hover:bg-gray-600 transition-colors list-none flex items-center justify-between w-full">
                                <span>Assign to branches</span>
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </summary>
                              <div className="absolute top-full left-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-[9999] w-full md:min-w-[200px]">
                                <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
                                  {branches.map(branch => {
                                    const pendingBranches = pendingAssignments[user.id] || []
                                    const isAssigned = pendingBranches.includes(branch)
                                    return (
                                      <label key={branch} className="flex items-center space-x-2 p-3 md:p-2 hover:bg-gray-600 rounded cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={isAssigned}
                                          onChange={() => {
                                            if (isAssigned) {
                                              // Remove from pending branches
                                              setPendingAssignments(prev => ({
                                                ...prev,
                                                [user.id]: pendingBranches.filter(b => b !== branch)
                                              }))
                                            } else {
                                              // Add to pending branches
                                              setPendingAssignments(prev => ({
                                                ...prev,
                                                [user.id]: [...pendingBranches, branch]
                                              }))
                                            }
                                          }}
                                          className="w-4 h-4 text-purple-500 bg-gray-600 border-gray-500 rounded focus:ring-purple-500"
                                        />
                                        <span className="text-white text-sm">{branch}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                                <div className="border-t border-gray-600 p-2">
                                  <button
                                    onClick={() => {
                                      // Clear all pending branch assignments
                                      setPendingAssignments(prev => ({
                                        ...prev,
                                        [user.id]: []
                                      }))
                                    }}
                                    className="w-full text-xs text-red-400 hover:text-red-300 py-2 md:py-1"
                                  >
                                    Clear all branches
                                  </button>
                                </div>
                              </div>
                            </details>
                          </div>

                          {user.approval_status === 'pending' && (
                            <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                              <button
                                onClick={() => handleApproval(user.id, 'approved')}
                                className="px-4 py-3 md:px-3 md:py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm md:text-xs"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleApproval(user.id, 'rejected')}
                                className="px-4 py-3 md:px-3 md:py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm md:text-xs"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                  </div>
                </div>
              )}

              {/* Users by Branch */}
              {Object.entries(usersByBranch).map(([branch, branchUsers]) => (
                <div key={branch} className="cosmic-card w-1/2 mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg md:text-xl font-semibold text-white flex-1 min-w-0">{branch}</h3>
              <div className="flex gap-1 md:gap-2 ml-2">
                <button
                  onClick={() => {
                    setSelectedBranch(branch)
                    setShowAddUserModal(true)
                  }}
                  className="bg-gradient-to-br from-purple-600 to-purple-800 text-white border-none rounded-lg text-xs md:text-[13px] font-medium px-2 py-1.5 md:px-4 md:py-1.5 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-purple-500 hover:to-purple-700"
                  title="Add user to branch"
                >
                  Add User
                </button>
                <button
                  onClick={() => handleDeleteBranchClick(branch)}
                  className="px-2 py-1.5 md:px-3 md:py-1 text-xs md:text-sm border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 rounded-lg transition-colors"
                  title="Delete branch"
                >
                  Delete Branch
                </button>
              </div>
            </div>
            
            <div className="space-y-4 md:space-y-3">
              {branchUsers.map((user, index) => (
                <div key={user.id} className="flex md:flex-row md:items-center gap-4 md:gap-3 p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg relative transition-colors">
                  {/* Mobile: Status badge top-right */}
                  <div className="absolute top-3 right-3 md:relative md:top-auto md:right-auto md:order-2 flex flex-col gap-1 items-end md:flex-row md:items-center md:gap-2">
                    <span className={`px-2 py-1 md:px-3 md:py-1 rounded-full text-xs font-medium text-center ${
                      user.approval_status === 'approved'
                        ? 'bg-green-900/20 text-green-400'
                        : user.approval_status === 'rejected'
                        ? 'bg-red-900/20 text-red-400'
                        : 'bg-yellow-900/20 text-yellow-400'
                    }`}>
                      {user.approval_status === 'approved' ? 'Active' : user.approval_status}
                    </span>

                    {/* Delete User Button - Mobile: below status, Desktop: inline */}
                    <button
                      onClick={() => handleDeleteUserClick(user, branch)}
                      className="p-1.5 md:px-2 md:py-2 text-sm border border-gray-500/50 text-gray-400 hover:bg-gray-500/10 hover:border-gray-500 hover:text-red-400 rounded-lg transition-colors flex items-center justify-center user-delete-button-mobile"
                      title="Remove user from branch"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-3 flex-1 md:order-1 pr-20 md:pr-0">
                    <NumberedAvatar
                      number={index + 1}
                      size="md"
                    />
                    <div className="text-white">
                      <div className="font-medium text-base md:text-sm">{user.user_name}</div>
                      <div className="text-[10px] md:text-xs text-gray-400 mt-1">
                        <span className="text-purple-400 font-semibold">{user.role}</span>
                        <span className="mx-2">•</span>
                        <span>{user.email}</span>
                      </div>
                    </div>
                  </div>

                  {user.approval_status === 'pending' && (
                    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto md:order-3">
                      <button
                        onClick={() => handleApproval(user.id, 'approved')}
                        className="px-4 py-3 md:px-4 md:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApproval(user.id, 'rejected')}
                        className="px-4 py-3 md:px-4 md:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {branchUsers.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                No users in this branch
              </div>
            )}
          </div>
              ))}
            </div>

            {loading && (
              <div className="cosmic-card text-center py-12">
                <div className="flex items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
                  <div className="text-gray-400 text-lg">Loading users...</div>
                </div>
              </div>
            )}

            {!loading && users.length === 0 && adminCompany && (
              <div className="cosmic-card text-center py-12">
                <div className="text-gray-400 text-lg">No users found for {adminCompany}</div>
              </div>
            )}
          </div>
        </div>

        {/* Add User Modal */}
        {showAddUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
            <div className="cosmic-card w-full md:max-w-lg md:w-full rounded-t-lg md:rounded-lg">
              <h3 className="cosmic-heading mb-4 text-white text-lg md:text-xl">Add User to {selectedBranch}</h3>
              <p className="text-gray-300 text-base md:text-sm mb-4">
                Select users to add to this branch:
              </p>

              <div className="max-h-80 md:max-h-64 overflow-y-auto space-y-3 md:space-y-2 mb-6">
                {users
                  .filter(u => {
                    const userBranches = (u.branch_name || '').split(',').map(b => b.trim()).filter(b => b !== '')
                    return !userBranches.includes(selectedBranch)
                  })
                  .map((user, index) => (
                    <div key={user.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 md:p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors">
                      <div className="flex items-center gap-3 text-white">
                        <NumberedAvatar
                          number={index + 1}
                          size="sm"
                        />
                        <div>
                          <div className="font-medium text-base md:text-sm">{user.user_name}</div>
                          <div className="text-sm md:text-xs text-gray-400 mt-1">
                            <span className="text-purple-400">{user.role}</span>
                            <span className="mx-2">•</span>
                            <span>{user.email}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddUserToBranch(user.id)}
                        className="px-4 py-3 md:px-3 md:py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors w-full md:w-auto"
                      >
                        Add to Branch
                      </button>
                    </div>
                  ))
                }

                {users.filter(u => {
                  const userBranches = (u.branch_name || '').split(',').map(b => b.trim()).filter(b => b !== '')
                  return !userBranches.includes(selectedBranch)
                }).length === 0 && (
                  <div className="text-center text-gray-400 py-12 md:py-8">
                    No users available to add to this branch
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-700 md:border-0 md:pt-0">
                <button
                  onClick={() => {
                    setShowAddUserModal(false)
                    setSelectedBranch('')
                  }}
                  className="cosmic-button-secondary px-6 py-4 md:py-3 border border-white/30 rounded-lg w-full md:w-auto text-base md:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Branch Modal */}
        {showDeleteBranchModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
            <div className="cosmic-card w-full md:max-w-md md:w-full rounded-t-lg md:rounded-lg">
              <h3 className="cosmic-heading mb-4 text-white text-lg md:text-xl">Delete Branch</h3>
              <p className="cosmic-body text-gray-300 mb-4 text-base md:text-sm">
                Are you sure you want to delete the branch &ldquo;{branchToDelete}&rdquo;?
              </p>
              {(() => {
                const usersInBranch = users.filter(u => {
                  const userBranches = (u.branch_name || '').split(',').map(b => b.trim()).filter(b => b !== '')
                  return userBranches.includes(branchToDelete)
                })
                if (usersInBranch.length > 0) {
                  return (
                    <p className="cosmic-body text-red-400 text-base md:text-sm mb-6">
                      Cannot delete: {usersInBranch.length} user(s) still assigned to this branch
                    </p>
                  )
                }
                return (
                  <p className="cosmic-body text-gray-400 text-base md:text-sm mb-6">
                    This action cannot be undone.
                  </p>
                )
              })()}
              <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4 pt-4 border-t border-gray-700 md:border-0 md:pt-0">
                <button
                  onClick={() => {
                    setShowDeleteBranchModal(false)
                    setBranchToDelete('')
                  }}
                  className="cosmic-button-secondary w-full md:flex-1 py-4 md:py-3 border border-white/30 rounded-lg text-base md:text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteBranch}
                  disabled={users.filter(u => {
                    const userBranches = (u.branch_name || '').split(',').map(b => b.trim()).filter(b => b !== '')
                    return userBranches.includes(branchToDelete)
                  }).length > 0}
                  className="w-full md:flex-1 py-4 md:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-sm"
                >
                  Delete Branch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Modal */}
        {showDeleteUserModal && userToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
            <div className="cosmic-card w-full md:max-w-md md:w-full rounded-t-lg md:rounded-lg">
              <h3 className="cosmic-heading mb-4 text-white text-lg md:text-xl">Remove User from Branch</h3>
              <p className="cosmic-body text-gray-300 mb-4 text-base md:text-sm">
                Are you sure you want to remove &ldquo;{userToDelete.user_name}&rdquo; from &ldquo;{branchToRemoveFrom}&rdquo;?
              </p>
              <p className="cosmic-body text-gray-400 text-base md:text-sm mb-6">
                Role: {userToDelete.role} • Email: {userToDelete.email}
              </p>
              <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4 pt-4 border-t border-gray-700 md:border-0 md:pt-0">
                <button
                  onClick={() => {
                    setShowDeleteUserModal(false)
                    setUserToDelete(null)
                    setBranchToRemoveFrom('')
                  }}
                  className="cosmic-button-secondary w-full md:flex-1 py-4 md:py-3 border border-white/30 rounded-lg text-base md:text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="w-full md:flex-1 py-4 md:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors text-base md:text-sm"
                >
                  Remove from Branch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Branch Modal */}
        {showCreateBranchModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
            <div className="cosmic-card w-full md:max-w-md md:w-full rounded-t-lg md:rounded-lg">
              <h3 className="cosmic-heading mb-4 text-white text-lg md:text-xl">Create New Branch</h3>
              <div className="mb-6">
                <label className="block text-gray-300 text-base md:text-sm font-medium mb-3 md:mb-2">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder={branches.length === 0 ? "Main Branch" : "e.g., Al Wasl Branch"}
                  className="w-full px-4 py-4 md:px-3 md:py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 text-base md:text-sm"
                  autoFocus
                />
              </div>
              <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4 pt-4 border-t border-gray-700 md:border-0 md:pt-0">
                <button
                  onClick={() => {
                    setShowCreateBranchModal(false)
                    setNewBranchName('')
                  }}
                  className="cosmic-button-secondary w-full md:flex-1 py-4 md:py-3 border border-white/30 rounded-lg text-base md:text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateBranch()}
                  disabled={!newBranchName.trim()}
                  className="w-full md:flex-1 py-4 md:py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-sm"
                >
                  Create Branch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite User Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center p-0 md:p-4 z-50">
            <div className="cosmic-card w-full md:max-w-md md:w-full rounded-t-lg md:rounded-lg flex flex-col min-h-[500px] md:min-h-[420px]">
              <h3 className="cosmic-heading mb-4 text-white text-lg md:text-xl">Invite New User</h3>
              <div className="space-y-6 md:space-y-4">
                <div>
                  <label className="block text-gray-300 text-base md:text-sm font-medium mb-3 md:mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-4 md:px-3 md:py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 text-base md:text-sm"
                    autoFocus
                  />
                </div>
                <div className="relative">
                  <label className="block text-gray-300 text-base md:text-sm font-medium mb-3 md:mb-2">
                    Role
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="w-full px-4 py-4 md:px-3 md:py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 text-left flex items-center justify-between text-base md:text-sm"
                  >
                    <span>{inviteRole}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showRoleDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-32 md:max-h-24 overflow-y-auto">
                      {['Staff', 'Admin'].map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            setInviteRole(role)
                            setShowRoleDropdown(false)
                          }}
                          className={`w-full text-left p-4 md:p-3 rounded-lg transition-colors text-base md:text-sm ${
                            inviteRole === role
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {role}
                          {inviteRole === role && (
                            <svg className="w-4 h-4 float-right mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-base md:text-sm text-gray-400">
                  <p>Inviting to: <span className="text-white font-medium">{adminCompany}</span></p>
                </div>
              </div>

              {/* Status Display */}
              
              {inviteStatus === 'error' && (
                <div className="mt-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-6 h-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <p className="text-red-400 font-medium">{inviteMessage}</p>
                  </div>
                </div>
              )}
              
              {inviteStatus === 'sending' && (
                <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mr-3"></div>
                    <p className="text-blue-400 font-medium text-base md:text-sm">Sending invitation email...</p>
                  </div>
                </div>
              )}
              <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4 mt-auto pt-8 md:pt-10 pb-6 relative z-[60] border-t border-gray-700 md:border-0">
                <button
                  onClick={() => {
                    setShowInviteModal(false)
                    setInviteEmail('')
                    setInviteRole('Staff')
                    setShowRoleDropdown(false)
                    setInviteStatus('idle')
                    setInviteMessage('')
                  }}
                  className="cosmic-button-secondary w-full md:flex-1 py-4 md:py-3 border border-white/30 rounded-lg text-base md:text-sm"
                  disabled={inviteStatus === 'sending' || inviteStatus === 'success'}
                >
                  {inviteStatus === 'success' ? 'Closing...' : 'Cancel'}
                </button>
                <button
                  onClick={handleInviteUser}
                  disabled={!inviteEmail.trim() || inviteStatus === 'sending' || inviteStatus === 'success'}
                  className="w-full md:flex-1 py-4 md:py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-sm"
                >
                  {inviteStatus === 'sending' ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </span>
                  ) : inviteStatus === 'success' ? (
                    <span className="flex items-center justify-center">
                      <svg className="w-4 h-4 text-white mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Sent!
                    </span>
                  ) : inviteStatus === 'error' ? (
                    'Try Again'
                  ) : (
                    'Send Invitation'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}