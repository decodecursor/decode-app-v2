/**
 * BeautyBusiness Model
 * Represents a reusable beauty business profile that can be linked to auctions
 */

export interface BeautyBusiness {
  id: string;
  creator_id: string;
  creator_name: string;
  business_name: string;
  instagram_handle: string;
  city: string;
  business_photo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBeautyBusinessDto {
  creator_id: string;
  creator_name: string;
  business_name: string;
  instagram_handle: string;
  city: string;
  business_photo_url?: string;
}

export interface UpdateBeautyBusinessDto {
  business_name?: string;
  instagram_handle?: string;
  city?: string;
  business_photo_url?: string;
}

export interface BeautyBusinessListItem {
  id: string;
  business_name: string;
  instagram_handle: string;
  city: string;
  business_photo_url?: string;
}
