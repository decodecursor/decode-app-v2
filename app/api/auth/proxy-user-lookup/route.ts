import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Proxy route to lookup user ID by email using service role
export async function POST(request: NextRequest) {
  console.log('🔄 [PROXY-USER-LOOKUP] === USER LOOKUP ROUTE CALLED ===')
  
  try {
    const { email } = await request.json()
    
    if (!email || typeof email !== 'string') {
      console.error('❌ [PROXY-USER-LOOKUP] Missing or invalid email')
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }
    
    console.log('🔍 [PROXY-USER-LOOKUP] Looking up user for email:', email.substring(0, 3) + '***')
    
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ [PROXY-USER-LOOKUP] Missing environment variables')
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }
    
    // Use service role client to access auth admin functions
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Look up user by email
    const { data: authUsers, error } = await supabase.auth.admin.listUsers()
    
    if (error) {
      console.error('❌ [PROXY-USER-LOOKUP] Auth admin error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to lookup user' },
        { status: 500 }
      )
    }
    
    const matchingUser = authUsers?.users?.find(u => u.email === email)
    
    if (matchingUser) {
      console.log('✅ [PROXY-USER-LOOKUP] Found user:', matchingUser.id)
      return NextResponse.json({
        success: true,
        userId: matchingUser.id,
        userEmail: matchingUser.email,
        emailConfirmed: !!matchingUser.email_confirmed_at
      })
    } else {
      console.log('⚠️ [PROXY-USER-LOOKUP] No user found for email')
      return NextResponse.json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      }, { status: 404 })
    }
    
  } catch (error: any) {
    console.error('💥 [PROXY-USER-LOOKUP] Error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    )
  }
}