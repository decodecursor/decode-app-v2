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

    // Get request data
    const { name, company_name } = await request.json()

    if (!name || !company_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Insert branch into database
    const { data, error } = await supabase
      .from('branches')
      .insert({
        name: name.trim(),
        company_name: company_name
      })
      .select()
      .single()

    if (error) {
      console.error('Branch creation error:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Branch already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, branch: data })

  } catch (error: any) {
    console.error('Branch API error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}