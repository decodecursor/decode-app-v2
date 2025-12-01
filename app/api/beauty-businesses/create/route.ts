/**
 * POST /api/beauty-businesses/create
 * Create a new beauty business profile (MODEL users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BeautyBusinessService } from '@/lib/services/BeautyBusinessService';
import type { CreateBeautyBusinessDto } from '@/lib/models/BeautyBusiness.model';
import { USER_ROLES, normalizeRole } from '@/types/user';

export async function POST(request: NextRequest) {
  try {
    console.log('🔵 [API /beauty-businesses/create] Request received');
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log('🔐 [API /beauty-businesses/create] Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      hasError: !!authError,
    });

    if (authError || !user) {
      console.error('❌ [API /beauty-businesses/create] Unauthorized - no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a MODEL and fetch user name
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, name')
      .eq('id', user.id)
      .single();

    console.log('👤 [API /beauty-businesses/create] User data fetch:', {
      hasData: !!userData,
      role: userData?.role,
      name: userData?.name,
      hasError: !!userError,
    });

    if (userError || !userData) {
      console.warn('⚠️ [API /beauty-businesses/create] User not in public.users, creating profile...');

      // Create minimal profile
      const { error: createError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          role: USER_ROLES.MODEL,
          name: user.email?.split('@')[0] || 'User',
          user_name: user.email?.split('@')[0] || 'User',
          company_name: '',
          created_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (createError) {
        console.error('❌ [API /beauty-businesses/create] Failed to create profile:', {
          error: createError,
          code: createError.code,
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          userId: user.id,
          userEmail: user.email
        });
        return NextResponse.json({
          error: 'Failed to create user profile. Please try again or contact support.',
          details: createError.message
        }, { status: 500 });
      }

      // Fetch the newly created user
      const { data: newUserData } = await supabase
        .from('users')
        .select('role, name')
        .eq('id', user.id)
        .single();

      userData = newUserData;
      console.log('✅ [API /beauty-businesses/create] Profile created successfully');
    }

    const normalizedRole = normalizeRole(userData.role);
    if (normalizedRole !== USER_ROLES.MODEL) {
      console.error('❌ [API /beauty-businesses/create] Access denied - user is not MODEL');
      return NextResponse.json(
        { error: 'Only MODEL users can create beauty businesses' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    console.log('📦 [API /beauty-businesses/create] Request body:', body);

    // Validate required fields
    if (!body.business_name || !body.instagram_handle || !body.city) {
      console.error('❌ [API /beauty-businesses/create] Validation failed - missing fields');
      return NextResponse.json(
        { error: 'Missing required fields: business_name, instagram_handle, city' },
        { status: 400 }
      );
    }

    // Create beauty business
    const beautyBusinessService = new BeautyBusinessService();
    const dto: CreateBeautyBusinessDto = {
      creator_id: user.id,
      creator_name: userData.name || 'Unknown',
      business_name: body.business_name,
      instagram_handle: body.instagram_handle,
      city: body.city,
      business_photo_url: body.business_photo_url,
    };

    console.log('🎯 [API /beauty-businesses/create] Calling BeautyBusinessService with DTO:', dto);

    const result = await beautyBusinessService.createBeautyBusiness(dto);

    console.log('📊 [API /beauty-businesses/create] Service result:', {
      success: result.success,
      businessId: result.business_id,
      error: result.error,
    });

    if (!result.success) {
      console.error('❌ [API /beauty-businesses/create] Service returned error:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log('✅ [API /beauty-businesses/create] Beauty business created successfully:', result.business_id);
    return NextResponse.json(
      {
        success: true,
        business_id: result.business_id,
        business: result.business,
        message: 'Beauty business created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('💥 [API /beauty-businesses/create] Unhandled exception:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
