import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { emailService } from '@/lib/email-service'

export async function POST(request: NextRequest) {
  console.log('🔄 [CREATE-PROFILE] === Profile creation proxy called ===')
  
  try {
    const profileData = await request.json()
    
    console.log('📝 [CREATE-PROFILE] Creating profile:', profileData)

    // Use service role client to bypass RLS for profile creation
    const supabase = createServiceRoleClient()

    // Check if user already exists to preserve user_name
    const { data: existingUser } = await supabase
      .from('users')
      .select('user_name')
      .eq('id', profileData.id)
      .single()

    // If user exists and has a user_name, preserve it (don't overwrite with auto-generated fallback)
    if (existingUser?.user_name) {
      console.log('ℹ️ [CREATE-PROFILE] User exists with user_name, preserving:', existingUser.user_name)
      profileData.user_name = existingUser.user_name
    }

    // Upsert profile (handles both new and existing users)
    const { data, error } = await supabase.from('users').upsert(profileData, { onConflict: 'id' })
    
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
      console.log('📧 [CREATE-PROFILE] Attempting to send admin notification email...')
      console.log('📧 [CREATE-PROFILE] Email data:', {
        to: 'sebastian@welovedecode.com',
        user: profileData.user_name,
        email: profileData.email,
        role: profileData.role,
        company: profileData.company_name,
        timestamp: new Date().toISOString()
      })

      const emailResult = await emailService.sendAdminUserRegistrationNotification({
        id: profileData.id,
        email: profileData.email,
        user_name: profileData.user_name,
        role: profileData.role,
        company_name: profileData.company_name,
        branch_name: profileData.branch_name,
        approval_status: profileData.approval_status || 'approved',
        instagram_handle: profileData.instagram_handle,
        created_at: new Date().toISOString()
      })

      if (emailResult.success) {
        console.log('✅ [CREATE-PROFILE] Admin registration notification sent successfully')
        console.log('✅ [CREATE-PROFILE] Email message ID:', emailResult.messageId)
      } else {
        console.error('❌ [CREATE-PROFILE] Admin notification email failed:', emailResult.error)
        console.error('❌ [CREATE-PROFILE] Email provider:', emailResult.provider)
      }
    } catch (emailError: any) {
      console.error('⚠️ [CREATE-PROFILE] Failed to send admin notification - FULL ERROR:', {
        message: emailError.message,
        stack: emailError.stack,
        name: emailError.name,
        code: emailError.code,
        timestamp: new Date().toISOString(),
        userData: {
          email: profileData.email,
          name: profileData.user_name,
          role: profileData.role,
          company: profileData.company_name
        }
      })
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