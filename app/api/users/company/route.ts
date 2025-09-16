import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company from profile
    const { data: userData, error: profileError } = await supabase
      .from('users')
      .select('company_name')
      .eq('id', user.id)
      .single()

    if (profileError || !userData) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Get all users in the same company
    const { data: companyUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, user_name, company_name, branch_name, role, approval_status, created_at')
      .eq('company_name', userData.company_name)
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('Users fetch error:', usersError)
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    // Get branches for the company
    const { data: branchesData, error: branchesError } = await supabase
      .from('branches')
      .select('name')
      .eq('company_name', userData.company_name)
      .order('name')

    if (branchesError) {
      console.error('Branches fetch error:', branchesError)
      return NextResponse.json({ error: branchesError.message }, { status: 500 })
    }

    return NextResponse.json({
      users: companyUsers || [],
      branches: branchesData?.map(b => b.name) || []
    })

  } catch (error: any) {
    console.error('Company users API error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}