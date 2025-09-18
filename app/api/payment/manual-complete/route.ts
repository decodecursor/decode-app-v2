import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Manual endpoint to mark a payment as complete for testing
// This simulates what the webhook would do
export async function POST(request: NextRequest) {
  try {
    const { paymentLinkId, transactionId } = await request.json();
    
    if (!paymentLinkId) {
      return NextResponse.json({
        error: 'Payment link ID is required'
      }, { status: 400 });
    }

    console.log('🔧 Manual payment completion for:', paymentLinkId);

    const supabase = await createClient();

    // Update payment link status
    const { error: linkError } = await supabase
      .from('payment_links')
      .update({
        payment_status: 'paid',
        is_paid: true,
        paid_at: new Date().toISOString()
      })
      .eq('id', paymentLinkId);

    if (linkError) {
      console.error('❌ Failed to update payment link:', linkError);
      throw linkError;
    }

    // If a transaction ID is provided, update that too
    if (transactionId) {
      const { error: txError } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (txError) {
        console.error('❌ Failed to update transaction:', txError);
        // Don't fail the whole request
      }
    }

    console.log('✅ Payment manually marked as complete');

    return NextResponse.json({
      success: true,
      message: 'Payment marked as complete',
      paymentLinkId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Manual payment completion failed:', error);
    return NextResponse.json({
      error: 'Failed to complete payment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check payment status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paymentLinkId = searchParams.get('paymentLinkId');

  if (!paymentLinkId) {
    return NextResponse.json({
      error: 'Payment link ID is required'
    }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('payment_links')
      .select('id, payment_status, paid_at, amount_aed, title')
      .eq('id', paymentLinkId)
      .single();

    if (error || !data) {
      return NextResponse.json({
        error: 'Payment link not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      paymentLink: data,
      isPaid: data.payment_status === 'paid'
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch payment status'
    }, { status: 500 });
  }
}