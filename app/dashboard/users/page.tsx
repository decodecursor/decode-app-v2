'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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
  const [users, setUsers] = useState<User[]>([])
  const [adminCompany, setAdminCompany] = useState<string>('')
  const [companyProfileImage, setCompanyProfileImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
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

  useEffect(() => {
    const loadUsers = async () => {
      try {
        // Get current admin user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/auth'
          return
        }

        // Get admin's company
        const { data: adminData } = await supabase
          .from('users')
          .select('company_name, role')
          .eq('id', user.id)
          .single()

        if (!adminData || adminData.role !== 'Admin') {
          window.location.href = '/dashboard'
          return
        }

        setAdminCompany(adminData.company_name)

        // TODO: Add profile_photo_url column to users table in database
        // For now, set to null - ProfileImage component will show user initials
        setCompanyProfileImage(null)

        // Get all users in the same company (remove profile_photo_url from query)
        const { data: companyUsers, error } = await supabase
          .from('users')
          .select('id, email, user_name, company_name, branch_name, role, approval_status, created_at')
          .eq('company_name', adminData.company_name)
          .order('created_at', { ascending: false })

        if (error) throw error
        setUsers(companyUsers || [])

        // Get unique branches for this company - include all branches from comma-separated values
        const allUserBranches = companyUsers?.flatMap(u => 
          (u.branch_name || 'Downtown Branch').split(',').map(b => b.trim())
        ) || []
        const uniqueBranches = [...new Set(['Downtown Branch', ...allUserBranches])]
        setBranches(uniqueBranches)

      } catch (error) {
        console.error('Error loading users:', error)
        setMessage('Failed to load users')
      }
    }

    loadUsers()
  }, [])

  const handleApproval = async (userId: string, action: 'approved' | 'rejected') => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
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
        // If approving without branch selection, assign to Downtown Branch by default
        updateData.branch_name = 'Downtown Branch'
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
    if (!newBranchName.trim() || !adminCompany) return
    
    try {
      // Add to local branches state - persist all created branches
      const updatedBranches = [...new Set([...branches, newBranchName.trim()])]
      setBranches(updatedBranches)
      
      setNewBranchName('')
      setShowCreateBranchModal(false)
    } catch (error) {
      console.error('Error creating branch:', error)
      setMessage('Failed to create branch')
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
        const userBranches = (u.branch_name || 'Downtown Branch').split(',').map(b => b.trim())
        return userBranches.includes(branchToDelete)
      })
      
      if (usersInBranch.length > 0) {
        setMessage(`Cannot delete '${branchToDelete}' - ${usersInBranch.length} user(s) still assigned to this branch`)
        setTimeout(() => setMessage(''), 3000)
        setShowDeleteBranchModal(false)
        setBranchToDelete('')
        return
      }
      
      // Don't allow deleting Downtown Branch
      if (branchToDelete === 'Downtown Branch') {
        setMessage('Cannot delete the default Downtown Branch')
        setTimeout(() => setMessage(''), 3000)
        setShowDeleteBranchModal(false)
        setBranchToDelete('')
        return
      }
      
      // Remove from local branches state
      const updatedBranches = branches.filter(b => b !== branchToDelete)
      setBranches(updatedBranches)
      
      setMessage(`Branch '${branchToDelete}' deleted successfully`)
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
      const currentBranches = (userToDelete.branch_name || 'Downtown Branch').split(',').map(b => b.trim())
      
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
      
      const currentBranches = (currentUser.branch_name || 'Downtown Branch').split(',').map(b => b.trim())
      
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
    <div className="cosmic-bg min-h-screen">
      <div className="min-h-screen px-4 py-8">
        {/* Back to Dashboard Link */}
        <div className="flex justify-center mb-8">
          <div style={{width: '70vw'}}>
            <Link href="/dashboard" className="inline-flex items-center text-gray-300 hover:text-white transition-colors">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Header Card */}
        <div className="flex justify-center mb-8">
          <div style={{width: '70vw'}}>
            <div className="cosmic-card">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="cosmic-heading mb-2">User Management</h1>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateBranchModal(true)}
                    className="bg-gradient-to-br from-purple-600 to-purple-800 text-white border-none rounded-lg text-[15px] font-medium px-5 py-2.5 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-purple-500 hover:to-purple-700 hover:shadow-[0_4px_12px_rgba(168,85,247,0.4)]"
                  >
                    Create Branch
                  </button>
                  <Link 
                    href="/payment/create"
                    className="bg-gradient-to-br from-gray-800 to-black text-white border-none rounded-lg text-[17px] font-medium px-6 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-gray-600 hover:to-gray-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] inline-block"
                  >
                    Create PayLink
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div className="flex justify-center mb-8">
            <div style={{width: '70vw'}}>
              <div className={`p-2 rounded-lg text-sm ${message.includes('Failed') ? 'bg-red-900/20 text-red-300' : 'bg-green-900/10 text-green-400 border border-green-500/20'}`}>
                {message}
              </div>
            </div>
          </div>
        )}


        <div className="flex justify-center">
          <div style={{width: '70vw'}}>
            <div className="space-y-6">
              {/* Unassigned Users Section */}
              {unassignedUsers.length > 0 && (
                <div className="w-1/2 mx-auto mb-6 border-2 border-red-500 bg-red-800 shadow-lg shadow-red-500/30 ring-2 ring-red-400/40 relative z-10 overflow-visible rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-white">
                      New User(s)
                    </h3>
                    <div className="text-base font-semibold text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-lg border border-yellow-400/30">
                      ⚠️ Awaiting branch assignment
                    </div>
                  </div>
                  
                  <div className="space-y-3 bg-black/20 rounded-lg p-4 border-l-4 border-red-500 shadow-inner">
                    {unassignedUsers.map((user, index) => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                        <div className="flex items-center gap-3 flex-1">
                          <NumberedAvatar 
                            number={index + 1}
                            size="md"
                          />
                          <div className="text-gray-300 text-sm">
                            <span className="font-medium">{user.user_name}</span>
                            <span className="text-gray-500 mx-2">•</span>
                            <span className="text-purple-400 font-semibold">{user.role}</span>
                            <span className="text-gray-500 mx-2">•</span>
                            <span className="text-gray-500">{user.email}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            user.approval_status === 'approved' 
                              ? 'bg-green-900/20 text-green-400' 
                              : user.approval_status === 'rejected'
                              ? 'bg-red-900/20 text-red-400'
                              : 'bg-yellow-900/20 text-yellow-400'
                          }`}>
                            {user.approval_status === 'approved' ? 'Active' : user.approval_status}
                          </span>
                          
                          {/* Multi-Branch Assignment Interface */}
                          <div className="relative">
                            <details className="relative">
                              <summary className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gray-600 transition-colors list-none flex items-center justify-between">
                                <span>Assign to branches</span>
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </summary>
                              <div className="absolute top-full left-0 mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-[9999] min-w-[200px]">
                                <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
                                  {branches.map(branch => {
                                    const pendingBranches = pendingAssignments[user.id] || []
                                    const isAssigned = pendingBranches.includes(branch)
                                    return (
                                      <label key={branch} className="flex items-center space-x-2 p-2 hover:bg-gray-600 rounded cursor-pointer">
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
                                    className="w-full text-xs text-red-400 hover:text-red-300 py-1"
                                  >
                                    Clear all branches
                                  </button>
                                </div>
                              </div>
                            </details>
                          </div>
                          
                          {user.approval_status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproval(user.id, 'approved')}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleApproval(user.id, 'rejected')}
                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs"
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
              <h3 className="text-xl font-semibold text-white">{branch}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedBranch(branch)
                    setShowAddUserModal(true)
                  }}
                  className="bg-gradient-to-br from-purple-600 to-purple-800 text-white border-none rounded-lg text-[13px] font-medium px-4 py-1.5 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-purple-500 hover:to-purple-700"
                  title="Add user to branch"
                >
                  Add User
                </button>
                <button
                  onClick={() => handleDeleteBranchClick(branch)}
                  className="px-3 py-1 text-sm border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 rounded-lg transition-colors"
                  title="Delete branch"
                >
                  Delete Branch
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              {branchUsers.map((user, index) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <NumberedAvatar 
                      number={index + 1}
                      size="md"
                    />
                    <div className="text-white text-sm">
                      <span className="font-medium">{user.user_name}</span>
                      <span className="text-gray-400 mx-2">•</span>
                      <span className="text-purple-400 font-semibold">{user.role}</span>
                      <span className="text-gray-400 mx-2">•</span>
                      <span className="text-gray-400">{user.email}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.approval_status === 'approved' 
                        ? 'bg-green-900/20 text-green-400' 
                        : user.approval_status === 'rejected'
                        ? 'bg-red-900/20 text-red-400'
                        : 'bg-yellow-900/20 text-yellow-400'
                    }`}>
                      {user.approval_status === 'approved' ? 'Active' : user.approval_status}
                    </span>
                    
                    {user.approval_status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproval(user.id, 'approved')}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproval(user.id, 'rejected')}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    
                    {/* Delete User Button */}
                    <button
                      onClick={() => handleDeleteUserClick(user, branch)}
                      className="px-2 py-2 text-sm border border-gray-500/50 text-gray-400 hover:bg-gray-500/10 hover:border-gray-500 hover:text-red-400 rounded-lg transition-colors"
                      title="Remove user from branch"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
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

            {users.length === 0 && (
              <div className="cosmic-card text-center py-12">
                <div className="text-gray-400 text-lg">No users found for {adminCompany}</div>
              </div>
            )}
          </div>
        </div>

        {/* Add User Modal */}
        {showAddUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="cosmic-card max-w-lg w-full">
              <h3 className="cosmic-heading mb-4 text-white">Add User to {selectedBranch}</h3>
              <p className="text-gray-300 text-sm mb-4">
                Select users to add to this branch:
              </p>
              
              <div className="max-h-64 overflow-y-auto space-y-2 mb-6">
                {users
                  .filter(u => {
                    const userBranches = (u.branch_name || '').split(',').map(b => b.trim()).filter(b => b !== '')
                    return !userBranches.includes(selectedBranch)
                  })
                  .map((user, index) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-3 text-white text-sm">
                        <NumberedAvatar 
                          number={index + 1}
                          size="sm"
                        />
                        <div>
                          <span className="font-medium">{user.user_name}</span>
                          <span className="text-gray-400 mx-2">•</span>
                          <span className="text-purple-400">{user.role}</span>
                          <span className="text-gray-400 mx-2">•</span>
                          <span className="text-gray-400">{user.email}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddUserToBranch(user.id)}
                        className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  ))
                }
                
                {users.filter(u => {
                  const userBranches = (u.branch_name || 'Downtown Branch').split(',').map(b => b.trim())
                  return !userBranches.includes(selectedBranch)
                }).length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    No users available to add to this branch
                  </div>
                )}
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowAddUserModal(false)
                    setSelectedBranch('')
                  }}
                  className="cosmic-button-secondary px-6 py-3 border border-white/30 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Branch Modal */}
        {showDeleteBranchModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="cosmic-card max-w-md w-full">
              <h3 className="cosmic-heading mb-4 text-white">Delete Branch</h3>
              <p className="cosmic-body text-gray-300 mb-4">
                Are you sure you want to delete the branch &ldquo;{branchToDelete}&rdquo;?
              </p>
              {(() => {
                const usersInBranch = users.filter(u => (u.branch_name || 'Downtown Branch') === branchToDelete)
                if (usersInBranch.length > 0) {
                  return (
                    <p className="cosmic-body text-red-400 text-sm mb-6">
                      Cannot delete: {usersInBranch.length} user(s) still assigned to this branch
                    </p>
                  )
                }
                return (
                  <p className="cosmic-body text-gray-400 text-sm mb-6">
                    This action cannot be undone.
                  </p>
                )
              })()}
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowDeleteBranchModal(false)
                    setBranchToDelete('')
                  }}
                  className="cosmic-button-secondary flex-1 py-3 border border-white/30 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteBranch}
                  disabled={users.filter(u => (u.branch_name || 'Downtown Branch') === branchToDelete).length > 0}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete Branch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Modal */}
        {showDeleteUserModal && userToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="cosmic-card max-w-md w-full">
              <h3 className="cosmic-heading mb-4 text-white">Remove User from Branch</h3>
              <p className="cosmic-body text-gray-300 mb-4">
                Are you sure you want to remove &ldquo;{userToDelete.user_name}&rdquo; from &ldquo;{branchToRemoveFrom}&rdquo;?
              </p>
              <p className="cosmic-body text-gray-400 text-sm mb-6">
                Role: {userToDelete.role} • Email: {userToDelete.email}
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowDeleteUserModal(false)
                    setUserToDelete(null)
                    setBranchToRemoveFrom('')
                  }}
                  className="cosmic-button-secondary flex-1 py-3 border border-white/30 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Remove from Branch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Branch Modal */}
        {showCreateBranchModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="cosmic-card max-w-md w-full">
              <h3 className="cosmic-heading mb-4 text-white">Create New Branch</h3>
              <div className="mb-4">
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g., Dubai Marina"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setShowCreateBranchModal(false)
                    setNewBranchName('')
                  }}
                  className="cosmic-button-secondary flex-1 py-3 border border-white/30 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim()}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Branch
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}