import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('beauty_businesses')
      .select('id, business_name, instagram_handle, city, business_photo_url')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[GET /api/beauty-businesses/[id]] Error:', error);
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, business: data });
  } catch (error) {
    console.error('[GET /api/beauty-businesses/[id]] Exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
