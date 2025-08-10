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

  // Group by branch
  const usersByBranch = users.reduce((acc, user) => {
    const branch = user.branch_name || 'No Branch'
    if (!acc[branch]) acc[branch] = []
    acc[branch].push(user)
    return acc
  }, {} as Record<string, User[]>)

  return (
    <div className="cosmic-bg min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">User Management</h1>
            <p className="text-gray-300">{adminCompany}</p>
          </div>
          <Link 
            href="/dashboard"
            className="nav-button text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors px-4 py-2"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.includes('Failed') ? 'bg-red-900/20 text-red-300' : 'bg-green-900/20 text-green-300'}`}>
            {message}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 w-1/2 mx-auto">
          <div className="cosmic-card text-center">
            <div className="text-3xl font-bold text-yellow-400">{pendingUsers.length}</div>
            <div className="text-gray-300">Pending Approval</div>
          </div>
          <div className="cosmic-card text-center">
            <div className="text-3xl font-bold text-green-400">{approvedUsers.length}</div>
            <div className="text-gray-300">Approved Users</div>
          </div>
          <div className="cosmic-card text-center">
            <div className="text-3xl font-bold text-red-400">{rejectedUsers.length}</div>
            <div className="text-gray-300">Rejected Users</div>
          </div>
        </div>

        {/* Users by Branch */}
        {Object.entries(usersByBranch).map(([branch, branchUsers]) => (
          <div key={branch} className="cosmic-card mb-6 w-1/2 mx-auto">
            <h3 className="text-xl font-semibold text-white mb-4">{branch}</h3>
            
            <div className="space-y-3">
              {branchUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex-1">
                    <div className="text-white font-medium">{user.user_name}</div>
                    <div className="text-gray-300 text-sm">{user.email}</div>
                    <div className="text-xs text-gray-400">
                      {user.role} • {new Date(user.created_at).toLocaleDateString()}
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
                      {user.approval_status}
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

        {users.length === 0 && (
          <div className="cosmic-card text-center py-12">
            <div className="text-gray-400 text-lg">No users found for {adminCompany}</div>
          </div>
        )}
      </div>
    </div>
  )
}