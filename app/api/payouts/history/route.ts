import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export async function GET(request: NextRequest) {
  try {
    // Use the same working authentication as other API endpoints
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      )
    }

    const userId = user.id

    // Get URL parameters
    const url = new URL(request.url)
    const limit = url.searchParams.get('limit')
    const exportAll = url.searchParams.get('export') === 'true'

    // Use service role client to query data
    const supabaseService = createServiceRoleClient()

    let query = supabaseService
      .from('payouts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Apply limit only if not exporting all
    if (!exportAll && limit) {
      query = query.limit(parseInt(limit))
    } else if (!exportAll) {
      query = query.limit(10) // Default limit
    }

    const { data: payouts, error } = await query

    if (error) {
      console.error('Error fetching payouts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch payouts' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      payouts: payouts || []
    })

  } catch (error: any) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    )
  }
}