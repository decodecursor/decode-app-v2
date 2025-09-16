import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [API] Company users endpoint called')
    const supabase = await createClient()

    // Get current user
    console.log('🔍 [API] Getting current user...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('❌ [API] Auth error:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 [API] User authenticated:', user.id)

    // Get user's company from profile
    console.log('🔍 [API] Fetching user profile...')
    const { data: userData, error: profileError } = await supabase
      .from('users')
      .select('company_name')
      .eq('id', user.id)
      .single()

    if (profileError || !userData) {
      console.error('❌ [API] Profile error:', profileError?.message)
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    console.log('🔍 [API] User company:', userData.company_name)

    // Get all users in the same company
    console.log('🔍 [API] Fetching company users...')
    const { data: companyUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, user_name, company_name, branch_name, role, approval_status, created_at')
      .eq('company_name', userData.company_name)
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('❌ [API] Users fetch error:', usersError.message)
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    console.log('🔍 [API] Found users:', companyUsers?.length)

    // Get branches for the company
    console.log('🔍 [API] Fetching branches...')
    const { data: branchesData, error: branchesError } = await supabase
      .from('branches')
      .select('name')
      .eq('company_name', userData.company_name)
      .order('name')

    if (branchesError) {
      console.error('❌ [API] Branches fetch error:', branchesError.message)
      return NextResponse.json({ error: branchesError.message }, { status: 500 })
    }

    console.log('🔍 [API] Found branches:', branchesData?.length)

    const result = {
      users: companyUsers || [],
      branches: branchesData?.map(b => b.name) || []
    }

    console.log('✅ [API] Returning data:', result)
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Company users API error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}