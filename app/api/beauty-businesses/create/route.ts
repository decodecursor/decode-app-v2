/**
 * POST /api/beauty-businesses/create
 * Create a new beauty business profile (MODEL users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
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
      .select('role, user_name')
      .eq('id', user.id)
      .single();

    console.log('👤 [API /beauty-businesses/create] User data fetch:', {
      hasData: !!userData,
      role: userData?.role,
      user_name: userData?.user_name,
      hasError: !!userError,
    });

    if (userError || !userData) {
      console.warn('⚠️ [API /beauty-businesses/create] User not in public.users, creating profile...');

      // Use service role client to bypass RLS for profile creation
      const serviceClient = createServiceRoleClient();

      // First, check if user already exists (to preserve existing user_name)
      const { data: existingUser } = await serviceClient
        .from('users')
        .select('id, user_name')
        .eq('id', user.id)
        .single();

      // Only insert if user doesn't exist (prevent overwriting existing user_name)
      if (!existingUser) {
        const { error: createError } = await serviceClient
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            role: 'User',  // Database constraint only allows 'Admin' or 'User'
            user_name: user.email?.split('@')[0] || 'User',
            company_name: '',
            created_at: new Date().toISOString()
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

          // If error is NOT a unique constraint violation, return error
          if (createError.code !== '23505') {
            return NextResponse.json({
              error: 'Failed to create user profile. Please try again or contact support.',
              details: createError.message
            }, { status: 500 });
          }
          // If unique constraint violation, user exists now, continue
          console.log('ℹ️ [API /beauty-businesses/create] User already exists (created concurrently), continuing...');
        } else {
          console.log('✅ [API /beauty-businesses/create] Profile created successfully');
        }
      } else {
        console.log('ℹ️ [API /beauty-businesses/create] User already exists, preserving existing user_name');
      }

      // Fetch the user data (whether just created or already existing)
      const { data: newUserData } = await supabase
        .from('users')
        .select('role, user_name')
        .eq('id', user.id)
        .single();

      userData = newUserData;
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
    console.error('💥 [API /beauty-businesses/create] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
