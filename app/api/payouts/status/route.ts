import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get user's payout summary
    const { data: payouts, error: payoutsError } = await supabaseAdmin
      .from('payouts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (payoutsError) {
      console.error('Error fetching payouts:', payoutsError)
      return NextResponse.json(
        { error: 'Failed to fetch payout status' },
        { status: 500 }
      )
    }

    // Calculate summary statistics
    const totalPayouts = payouts?.length || 0
    const pendingPayouts = payouts?.filter(p => p.status === 'pending').length || 0
    const completedPayouts = payouts?.filter(p => p.status === 'paid').length || 0
    const totalPaidAmount = payouts
      ?.filter(p => p.status === 'paid')
      ?.reduce((sum, p) => sum + (p.amount_aed || 0), 0) || 0

    const lastPayout = payouts?.find(p => p.status === 'paid')
    const nextPendingPayout = payouts?.find(p => p.status === 'pending')

    return NextResponse.json({
      success: true,
      summary: {
        totalPayouts,
        pendingPayouts,
        completedPayouts,
        totalPaidAmount,
        lastPayout: lastPayout ? {
          id: lastPayout.id,
          amount: lastPayout.amount_aed,
          paidAt: lastPayout.paid_at,
          periodStart: lastPayout.period_start,
          periodEnd: lastPayout.period_end
        } : null,
        nextPendingPayout: nextPendingPayout ? {
          id: nextPendingPayout.id,
          amount: nextPendingPayout.amount_aed,
          scheduledFor: nextPendingPayout.scheduled_for,
          status: nextPendingPayout.status
        } : null
      },
      recentPayouts: payouts?.slice(0, 5) || []
    })

  } catch (error: any) {
    console.error('Payout status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}