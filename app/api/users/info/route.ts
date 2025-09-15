import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Get user ID from cookies
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    // Extract user ID from session cookies
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`

    let sessionData: any = null
    const singleCookie = allCookies.find(c => c.name === cookieName)

    if (singleCookie) {
      try {
        sessionData = JSON.parse(singleCookie.value)
      } catch (e) {
        // Try chunked cookies
        const chunks: string[] = []
        let chunkIndex = 0
        while (true) {
          const chunkCookie = allCookies.find(c => c.name === `${cookieName}.${chunkIndex}`)
          if (!chunkCookie) break
          chunks.push(chunkCookie.value)
          chunkIndex++
        }
        if (chunks.length > 0) {
          const fullSession = chunks.join('')
          sessionData = JSON.parse(fullSession)
        }
      }
    } else {
      // Look for chunked cookies
      const chunks: string[] = []
      let chunkIndex = 0
      while (true) {
        const chunkCookie = allCookies.find(c => c.name === `${cookieName}.${chunkIndex}`)
        if (!chunkCookie) break
        chunks.push(chunkCookie.value)
        chunkIndex++
      }
      if (chunks.length > 0) {
        const fullSession = chunks.join('')
        sessionData = JSON.parse(fullSession)
      }
    }

    if (!sessionData || !sessionData.user) {
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      )
    }

    const userId = sessionData.user.id

    // Use service role to query data
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Fetch user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, company_name, branch_name')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json(
        { error: 'Failed to get user information' },
        { status: 500 }
      )
    }

    // Count branches if company exists
    let branchCount = 0
    if (userData.company_name) {
      const { data: companyUsers } = await supabase
        .from('users')
        .select('branch_name')
        .eq('company_name', userData.company_name)
        .not('branch_name', 'is', null)

      if (companyUsers) {
        // Count unique branches
        const uniqueBranches = new Set<string>()
        companyUsers.forEach(user => {
          if (user.branch_name) {
            // Handle comma-separated branches
            const branches = user.branch_name.split(',').map(b => b.trim()).filter(b => b !== '')
            branches.forEach(branch => uniqueBranches.add(branch))
          }
        })
        branchCount = uniqueBranches.size
      }
    }

    return NextResponse.json({
      success: true,
      role: userData.role,
      companyName: userData.company_name,
      branchCount
    })

  } catch (error: any) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    )
  }
}