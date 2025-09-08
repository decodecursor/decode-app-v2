import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' }, 
        { status: 400 }
      )
    }

    // Create admin client with service role key - check env vars first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Configuration error' }, 
        { status: 500 }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey) as any

    // Check if email exists in auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error checking auth users:', authError)
      return NextResponse.json(
        { error: 'Failed to check email' }, 
        { status: 500 }
      )
    }

    const emailExists = authUsers?.users?.some((user: any) => user.email === email)

    return NextResponse.json({
      exists: !!emailExists,
      email: email
    })

  } catch (error) {
    console.error('Email check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}