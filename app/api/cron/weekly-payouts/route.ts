import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripeTransferService } from '@/lib/stripe-transfer-service'

// This endpoint should be called by a cron job every Monday at midnight
// You can use Vercel Cron Jobs or an external service like cron-job.org

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request (add your own auth method)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🏦 Starting weekly payout process...')

    // Get all active beauty professionals with connected accounts
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, stripe_connect_account_id')
      .eq('role', 'Beauty Professional')
      .eq('stripe_connect_status', 'active')
      .not('stripe_connect_account_id', 'is', null)

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }

    const results = {
      total: users?.length || 0,
      successful: 0,
      failed: 0,
      errors: [] as any[]
    }

    // Process payouts for each user
    for (const user of users || []) {
      try {
        console.log(`Processing payout for user ${user.email}...`)
        
        const payout = await stripeTransferService.createWeeklyPayout(
          user.stripe_connect_account_id!,
          user.id
        )

        if (payout) {
          results.successful++
          console.log(`✅ Payout created for ${user.email}: AED ${payout.amount}`)
        } else {
          console.log(`⏭️ No balance for ${user.email}, skipping`)
        }

      } catch (error) {
        results.failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push({
          userId: user.id,
          email: user.email,
          error: errorMessage
        })
        console.error(`❌ Failed to create payout for ${user.email}:`, error)
      }
    }

    console.log('🏁 Weekly payout process completed:', results)

    // Send summary email (optional)
    if (process.env.ADMIN_EMAIL) {
      // TODO: Send email summary to admin
    }

    return NextResponse.json({
      success: true,
      message: 'Weekly payouts processed',
      results
    })

  } catch (error) {
    console.error('Weekly payout cron job failed:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Weekly payout processing failed',
        success: false
      },
      { status: 500 }
    )
  }
}

// Also support POST for some cron services
export async function POST(request: NextRequest) {
  return GET(request)
}