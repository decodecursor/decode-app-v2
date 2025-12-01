/**
 * BeautyBusiness Service
 * Handles CRUD operations for beauty business profiles
 */

import { createClient } from '@/utils/supabase/server';
import type {
  BeautyBusiness,
  CreateBeautyBusinessDto,
  UpdateBeautyBusinessDto,
} from '@/lib/models/BeautyBusiness.model';

export class BeautyBusinessService {
  /**
   * Create a new beauty business
   */
  async createBeautyBusiness(dto: CreateBeautyBusinessDto): Promise<{ success: boolean; business_id?: string; business?: BeautyBusiness; error?: string }> {
    const supabase = await createClient();

    try {
      console.log('🔧 [BeautyBusinessService] createBeautyBusiness called with DTO:', dto);

      // Build insert object
      const insertData: any = {
        creator_id: dto.creator_id,
        business_name: dto.business_name,
        instagram_handle: dto.instagram_handle,
        city: dto.city,
      };

      // Add optional photo URL if provided
      if (dto.business_photo_url) {
        insertData.business_photo_url = dto.business_photo_url;
      }

      console.log('📤 [BeautyBusinessService] Inserting data to Supabase:', insertData);

      const { data, error } = await supabase
        .from('beauty_businesses')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('❌ [BeautyBusinessService] Supabase insert error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      console.log('✅ [BeautyBusinessService] Beauty business created successfully:', {
        businessId: data.id,
        businessName: data.business_name
      });

      return { success: true, business_id: data.id, business: data as BeautyBusiness };
    } catch (error) {
      console.error('💥 [BeautyBusinessService] Error creating beauty business:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create beauty business',
      };
    }
  }

  /**
   * Get beauty business by ID
   */
  async getBeautyBusiness(businessId: string): Promise<BeautyBusiness | null> {
    const supabase = await createClient();

    try {
      const { data, error } = await supabase
        .from('beauty_businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      if (error) {
        console.error('❌ [BeautyBusinessService] Error fetching beauty business:', error);
        return null;
      }

      return data as BeautyBusiness;
    } catch (error) {
      console.error('💥 [BeautyBusinessService] Error in getBeautyBusiness:', error);
      return null;
    }
  }

  /**
   * List all beauty businesses for a specific creator
   */
  async listBeautyBusinesses(creatorId: string): Promise<BeautyBusiness[]> {
    const supabase = await createClient();

    try {
      console.log('🔍 [BeautyBusinessService] Listing businesses for creator:', creatorId);

      const { data, error } = await supabase
        .from('beauty_businesses')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [BeautyBusinessService] Error listing beauty businesses:', error);
        return [];
      }

      console.log('✅ [BeautyBusinessService] Found businesses:', data?.length || 0);
      return (data || []) as BeautyBusiness[];
    } catch (error) {
      console.error('💥 [BeautyBusinessService] Error in listBeautyBusinesses:', error);
      return [];
    }
  }

  /**
   * Update an existing beauty business
   */
  async updateBeautyBusiness(businessId: string, dto: UpdateBeautyBusinessDto): Promise<{ success: boolean; business?: BeautyBusiness; error?: string }> {
    const supabase = await createClient();

    try {
      console.log('🔧 [BeautyBusinessService] updateBeautyBusiness called:', { businessId, dto });

      const { data, error } = await supabase
        .from('beauty_businesses')
        .update(dto)
        .eq('id', businessId)
        .select()
        .single();

      if (error) {
        console.error('❌ [BeautyBusinessService] Error updating beauty business:', error);
        throw error;
      }

      console.log('✅ [BeautyBusinessService] Beauty business updated successfully');
      return { success: true, business: data as BeautyBusiness };
    } catch (error) {
      console.error('💥 [BeautyBusinessService] Error in updateBeautyBusiness:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update beauty business',
      };
    }
  }

  /**
   * Delete a beauty business
   */
  async deleteBeautyBusiness(businessId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    try {
      console.log('🗑️ [BeautyBusinessService] Deleting beauty business:', businessId);

      const { error } = await supabase
        .from('beauty_businesses')
        .delete()
        .eq('id', businessId);

      if (error) {
        console.error('❌ [BeautyBusinessService] Error deleting beauty business:', error);
        throw error;
      }

      console.log('✅ [BeautyBusinessService] Beauty business deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('💥 [BeautyBusinessService] Error in deleteBeautyBusiness:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete beauty business',
      };
    }
  }
}

// Export singleton instance
export const beautyBusinessService = new BeautyBusinessService();
