import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Helper function to add CORS headers
function corsHeaders(request?: NextRequest) {
  const origin = request?.headers.get('origin') || ''
  
  // Allow specific origins
  const allowedOrigins = [
    'https://app.welovedecode.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000'
  ]
  
  // Check if origin is allowed, or use default for production
  const corsOrigin = allowedOrigins.includes(origin) 
    ? origin 
    : process.env.NODE_ENV === 'production' 
      ? 'https://app.welovedecode.com'
      : '*'
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true',
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders(request) })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' }, 
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) as any

    // Check if email exists in auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error checking auth users:', authError)
      return NextResponse.json(
        { error: 'Failed to check email' }, 
        { status: 500, headers: corsHeaders(request) }
      )
    }

    const emailExists = authUsers?.users?.some((user: any) => user.email === email)

    return NextResponse.json(
      { 
        exists: !!emailExists,
        email: email
      },
      { headers: corsHeaders(request) }
    )

  } catch (error) {
    console.error('Email check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500, headers: corsHeaders(request) }
    )
  }
}