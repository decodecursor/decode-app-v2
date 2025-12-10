/**
 * GET /api/beauty-businesses/list
 * List all beauty businesses for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BeautyBusinessService } from '@/lib/services/BeautyBusinessService';

export async function GET(request: NextRequest) {
  try {
    console.log('🔵 [API /beauty-businesses/list] Request received');
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ [API /beauty-businesses/list] Unauthorized - no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('👤 [API /beauty-businesses/list] Fetching businesses for user:', user.id);

    // Fetch user's beauty businesses
    const beautyBusinessService = new BeautyBusinessService();
    const businesses = await beautyBusinessService.listBeautyBusinesses(user.id);

    console.log('✅ [API /beauty-businesses/list] Found businesses:', businesses.length);
    return NextResponse.json(
      {
        success: true,
        businesses,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('💥 [API /beauty-businesses/list] Unhandled exception:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
