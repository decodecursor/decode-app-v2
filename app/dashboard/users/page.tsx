'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [showCreateBranchModal, setShowCreateBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [showDeleteBranchModal, setShowDeleteBranchModal] = useState(false)
  const [branchToDelete, setBranchToDelete] = useState('')
  const [branches, setBranches] = useState<string[]>([])

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

        // Get all users in the same company
        const { data: companyUsers, error } = await supabase
          .from('users')
          .select('id, email, user_name, company_name, branch_name, role, approval_status, created_at')
          .eq('company_name', adminData.company_name)
          .order('created_at', { ascending: false })

        if (error) throw error
        setUsers(companyUsers || [])

        // Get unique branches for this company
        const uniqueBranches = [...new Set(companyUsers?.map(u => u.branch_name || 'Downtown Branch') || [])]
        setBranches(uniqueBranches)

      } catch (error) {
        console.error('Error loading users:', error)
        setMessage('Failed to load users')
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [])

  const handleApproval = async (userId: string, action: 'approved' | 'rejected') => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('users')
        .update({
          approval_status: action,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      // Update local state
      setUsers(users.map(u => 
        u.id === userId 
          ? { ...u, approval_status: action }
          : u
      ))

      setMessage(`User ${action} successfully`)
      setTimeout(() => setMessage(''), 3000)

    } catch (error) {
      console.error('Error updating user:', error)
      setMessage('Failed to update user status')
    }
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim() || !adminCompany) return
    
    try {
      // Just add to local branches state - branches are created when users join them
      const updatedBranches = [...branches, newBranchName.trim()]
      setBranches(updatedBranches)
      
      setNewBranchName('')
      setShowCreateBranchModal(false)
      setMessage(`Branch '${newBranchName.trim()}' created successfully`)
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error creating branch:', error)
      setMessage('Failed to create branch')
    }
  }

  const handleDeleteBranch = async (branchName: string) => {
    try {
      // Check if any users are in this branch
      const usersInBranch = users.filter(u => (u.branch_name || 'Downtown Branch') === branchName)
      
      if (usersInBranch.length > 0) {
        setMessage(`Cannot delete '${branchName}' - ${usersInBranch.length} user(s) still assigned to this branch`)
        setTimeout(() => setMessage(''), 3000)
        return
      }
      
      // Remove from local branches state
      const updatedBranches = branches.filter(b => b !== branchName)
      setBranches(updatedBranches)
      
      setMessage(`Branch '${branchName}' deleted successfully`)
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error deleting branch:', error)
      setMessage('Failed to delete branch')
    }
  }

  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  const pendingUsers = users.filter(u => u.approval_status === 'pending')
  const approvedUsers = users.filter(u => u.approval_status === 'approved')
  const rejectedUsers = users.filter(u => u.approval_status === 'rejected')

  // Group by branch - include empty branches
  const usersByBranch = branches.reduce((acc, branch) => {
    acc[branch] = users.filter(u => (u.branch_name || 'Downtown Branch') === branch)
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
              <div className={`p-4 rounded-lg ${message.includes('Failed') ? 'bg-red-900/20 text-red-300' : 'bg-green-900/20 text-green-300'}`}>
                {message}
              </div>
            </div>
          </div>
        )}


        <div className="flex justify-center">
          <div style={{width: '70vw'}}>
            <div className="grid grid-cols-2 gap-6">
              {/* Users by Branch */}
              {Object.entries(usersByBranch).map(([branch, branchUsers]) => (
                <div key={branch} className="cosmic-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">{branch}</h3>
              <button
                onClick={() => handleDeleteBranch(branch)}
                className="px-3 py-1 text-sm border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 rounded-lg transition-colors"
                title="Delete branch"
              >
                Delete Branch
              </button>
            </div>
            
            <div className="space-y-3">
              {branchUsers.map(user => (
                <div key={user.id} className="flex items-start justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex-1">
                    <div className="text-purple-400 text-sm font-semibold mb-1">
                      {user.role}
                    </div>
                    <h4 className="text-white font-medium text-base mb-1">
                      {user.user_name}
                    </h4>
                    <div className="text-gray-400 text-sm">
                      {user.email}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 ml-4">
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