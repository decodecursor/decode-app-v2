import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emailService } from '@/lib/email-service'

export async function POST(request: NextRequest) {
  console.log('🔄 [CREATE-PROFILE] === Profile creation proxy called ===')
  
  try {
    const profileData = await request.json()
    
    console.log('📝 [CREATE-PROFILE] Creating profile:', profileData)
    
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !anonKey) {
      console.error('❌ [CREATE-PROFILE] Missing environment variables')
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }
    
    // Create supabase client
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Insert profile
    const { data, error } = await supabase.from('users').insert(profileData)
    
    if (error) {
      console.error('❌ [CREATE-PROFILE] Database error:', error)
      return NextResponse.json(
        { 
          success: false,
          error: error.message,
          code: error.code
        },
        { status: 400 }
      )
    }
    
    console.log('✅ [CREATE-PROFILE] Profile created successfully')

    // If this is an admin user, automatically create "Main Branch" entry in branches table
    if (profileData.role === 'Admin' && profileData.branch_name === 'Main Branch') {
      console.log('🔄 [CREATE-PROFILE] Creating Main Branch for admin user...')

      try {
        const { data: existingBranch, error: checkError } = await supabase
          .from('branches')
          .select('id')
          .eq('name', 'Main Branch')
          .eq('company_name', profileData.company_name)
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('⚠️ [CREATE-PROFILE] Error checking existing branch:', checkError)
        }

        // Only create branch if it doesn't exist
        if (!existingBranch) {
          const { error: branchError } = await supabase
            .from('branches')
            .insert({
              name: 'Main Branch',
              company_name: profileData.company_name
            })

          if (branchError) {
            console.error('⚠️ [CREATE-PROFILE] Failed to create Main Branch:', branchError)
            // Don't fail the entire registration if branch creation fails
          } else {
            console.log('✅ [CREATE-PROFILE] Main Branch created successfully')
          }
        } else {
          console.log('ℹ️ [CREATE-PROFILE] Main Branch already exists for company')
        }
      } catch (branchCreationError) {
        console.error('⚠️ [CREATE-PROFILE] Error during branch creation:', branchCreationError)
        // Don't fail the entire registration if branch creation fails
      }
    }

    // Send admin notification email for new user registration
    try {
      await emailService.sendAdminUserRegistrationNotification({
        id: profileData.id,
        email: profileData.email,
        user_name: profileData.user_name,
        role: profileData.role,
        company_name: profileData.company_name,
        branch_name: profileData.branch_name,
        approval_status: profileData.approval_status || 'approved',
        created_at: new Date().toISOString()
      })
      console.log('✅ [CREATE-PROFILE] Admin registration notification sent')
    } catch (emailError) {
      console.error('⚠️ [CREATE-PROFILE] Failed to send admin notification:', emailError)
      // Don't fail the registration if email fails
    }

    return NextResponse.json({
      success: true,
      data
    })
    
  } catch (error: any) {
    console.error('💥 [CREATE-PROFILE] Error:', error)
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