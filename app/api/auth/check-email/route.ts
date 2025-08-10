import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if email exists in auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error checking auth users:', authError)
      return NextResponse.json({ error: 'Failed to check email' }, { status: 500 })
    }

    const emailExists = authUsers?.users?.some(user => user.email === email)

    return NextResponse.json({ 
      exists: !!emailExists,
      email: email
    })

  } catch (error) {
    console.error('Email check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}