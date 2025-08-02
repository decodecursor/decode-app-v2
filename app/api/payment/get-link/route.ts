import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('id');

    if (!linkId) {
      return NextResponse.json({
        error: 'Payment link ID is required'
      }, { status: 400 });
    }

    console.log('🔍 API: Fetching payment link with service role:', linkId);

    // Fetch payment link using service role (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('payment_links')
      .select(`
        id,
        title,
        amount_aed,
        client_name,
        expiration_date,
        is_active,
        created_at,
        description,
        payment_status,
        paid_at,
        creator_id
      `)
      .eq('id', linkId)
      .single();

    if (error) {
      console.error('❌ API: Database error:', error);
      return NextResponse.json({
        error: 'Payment link not found',
        details: error.message
      }, { status: 404 });
    }

    if (!data) {
      return NextResponse.json({
        error: 'Payment link not found'
      }, { status: 404 });
    }

    // Only return active payment links to public
    if (!data.is_active) {
      return NextResponse.json({
        error: 'Payment link is not active'
      }, { status: 403 });
    }

    console.log('✅ API: Payment link fetched successfully');

    // Return payment link data (without sensitive info)
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        // Don't expose creator_id directly, just indicate it exists
        has_creator: !!data.creator_id
      }
    });

  } catch (error) {
    console.error('❌ API: Error fetching payment link:', error);
    return NextResponse.json({
      error: 'Failed to fetch payment link',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}