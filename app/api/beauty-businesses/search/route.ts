/**
 * GET /api/beauty-businesses/search
 * Search all beauty businesses across all users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔵 [API /beauty-businesses/search] Request received');
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ [API /beauty-businesses/search] Unauthorized - no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get search query from URL params
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    if (!query || query.trim().length === 0) {
      console.log('⚠️ [API /beauty-businesses/search] Empty query, returning empty results');
      return NextResponse.json(
        {
          success: true,
          businesses: [],
        },
        { status: 200 }
      );
    }

    console.log('🔍 [API /beauty-businesses/search] Searching for:', query);

    // Search across all businesses (no creator_id filter)
    // Search in business_name, instagram_handle, and city fields
    const searchTerm = `%${query}%`;

    const { data, error } = await supabase
      .from('beauty_businesses')
      .select('*')
      .or(`business_name.ilike.${searchTerm},instagram_handle.ilike.${searchTerm},city.ilike.${searchTerm}`)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to 50 results for performance

    if (error) {
      console.error('❌ [API /beauty-businesses/search] Error searching businesses:', error);
      return NextResponse.json(
        {
          error: 'Failed to search businesses',
          details: error.message,
        },
        { status: 500 }
      );
    }

    console.log('✅ [API /beauty-businesses/search] Found businesses:', data?.length || 0);
    return NextResponse.json(
      {
        success: true,
        businesses: data || [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('💥 [API /beauty-businesses/search] Unhandled exception:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
