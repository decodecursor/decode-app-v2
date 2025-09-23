import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is admin for the company
    const { data: userData, error: profileError } = await supabase
      .from('users')
      .select('role, company_name')
      .eq('id', user.id)
      .single()

    if (profileError || !userData) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (userData.role !== 'Admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get request data
    const { name, company_name } = await request.json()

    if (!name || !company_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify admin is creating branch for their own company
    if (userData.company_name !== company_name) {
      return NextResponse.json({ error: 'Can only create branches for your own company' }, { status: 403 })
    }

    // Check if branch already exists by looking at existing users
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('branch_name')
      .eq('company_name', company_name)

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }

    // Check if any user already has this branch name
    const existingBranch = existingUsers?.some(user => {
      if (!user.branch_name) return false
      const userBranches = user.branch_name.split(',').map(b => b.trim())
      return userBranches.includes(name.trim())
    })

    if (existingBranch) {
      return NextResponse.json({ error: 'Branch already exists' }, { status: 409 })
    }

    // Branches are created implicitly when users are assigned to them
    // So we just return success here
    return NextResponse.json({
      success: true,
      message: 'Branch ready for user assignment',
      branch: { name: name.trim(), company_name }
    })

  } catch (error: any) {
    console.error('Branch API error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}