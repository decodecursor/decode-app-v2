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

    // Extract unique branch names from users' branch_name field
    console.log('🔍 [API] Extracting branches from user data...')
    const branchesSet = new Set<string>()

    companyUsers?.forEach(user => {
      if (user.branch_name) {
        // Handle comma-separated branch names
        const userBranches = user.branch_name.split(',').map(b => b.trim()).filter(b => b !== '')
        userBranches.forEach(branch => branchesSet.add(branch))
      }
    })

    // Convert to sorted array
    const branches = Array.from(branchesSet).sort()
    console.log('🔍 [API] Extracted branches:', branches.length, branches)

    const result = {
      users: companyUsers || [],
      branches: branches
    }

    console.log('✅ [API] Returning data:', result)
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Company users API error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}