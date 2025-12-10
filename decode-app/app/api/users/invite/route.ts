import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { emailService } from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    const { email, role, companyName } = await request.json()

    if (!email || !role || !companyName) {
      return NextResponse.json(
        { error: 'Email, role, and company name are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Validate role
    if (!['Staff', 'Admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be either Staff or Admin' },
        { status: 400 }
      )
    }

    // Get current user and verify admin permissions
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify user is admin of the specified company  
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('role, company_name')
      .eq('id', user.id)
      .single()

    if (adminError || !adminData || adminData.role !== 'Admin' || adminData.company_name !== companyName) {
      return NextResponse.json(
        { error: 'Admin access required for the specified company' },
        { status: 403 }
      )
    }

    // Check if email already exists in the system
    const supabaseAdmin = createServiceRoleClient()
    const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers()

    if (checkError) {
      console.error('Error checking existing users:', checkError)
      return NextResponse.json(
        { error: 'Failed to verify email availability' },
        { status: 500 }
      )
    }

    const emailExists = existingUsers?.users?.some((existingUser: any) => existingUser.email === email)
    
    if (emailExists) {
      return NextResponse.json(
        { error: 'A user with this email address already exists' },
        { status: 400 }
      )
    }

    // Generate invitation link with pre-filled data
    const inviteData = {
      email,
      role,
      companyName,
      invitedBy: adminData.company_name,
      inviteDate: new Date().toISOString()
    }

    // Encode the invite data for the signup URL
    const encodedData = Buffer.from(JSON.stringify(inviteData)).toString('base64')
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.welovedecode.com'
    const signupUrl = `${baseUrl}/auth?invite=${encodedData}`

    // Send invitation email
    console.log(`🔗 [INVITE API] Preparing to send invitation email...`)
    console.log(`🔗 [INVITE API] Email: ${email}`)
    console.log(`🔗 [INVITE API] Company: ${companyName}`)
    console.log(`🔗 [INVITE API] Role: ${role}`)
    console.log(`🔗 [INVITE API] Signup URL: ${signupUrl}`)

    try {
      // Send invitation email using email service
      await emailService.sendInvitation({
        to: email,
        companyName,
        role,
        signupUrl,
        invitedBy: adminData.company_name || companyName
      })

      console.log(`✅ [INVITE API] Email sent successfully to ${email}`)
      return NextResponse.json({
        success: true,
        message: `Invitation sent successfully to ${email}`,
        emailSent: true
      })
    } catch (emailError) {
      console.error('❌ [INVITE API] Failed to send email:', emailError)

      // Provide signup URL as fallback when email fails
      return NextResponse.json({
        success: true,
        message: `Invitation created for ${email}, but email failed to send. Please share this signup URL manually: ${signupUrl}`,
        emailSent: false,
        signupUrl: signupUrl,
        error: 'Email delivery failed'
      })
    }

  } catch (error) {
    console.error('Invitation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}