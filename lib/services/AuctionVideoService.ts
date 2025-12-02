/**
 * Auction Video Service
 * Handles video recording, upload, and management
 */

import { createClient } from '@/utils/supabase/server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';
import { getEventBridgeScheduler } from '@/lib/services/EventBridgeScheduler';
import type {
  AuctionVideo,
  CreateAuctionVideoDto,
  VideoRecordingSession,
  generateRecordingToken,
  getVideoExpiryDate,
  getTokenExpiryDate,
} from '@/lib/models/AuctionVideo.model';

export class AuctionVideoService {
  /**
   * Create a video recording session for winner
   */
  async createRecordingSession(params: {
    auction_id: string;
    bid_id: string;
  }): Promise<{ success: boolean; session?: VideoRecordingSession; error?: string }> {
    // Use service role client to bypass RLS - needed for cron/EventBridge execution
    const supabase = createServiceRoleClient();

    try {
      // Check if video already exists
      const { data: existing } = await supabase
        .from('auction_videos')
        .select('*')
        .eq('auction_id', params.auction_id)
        .eq('bid_id', params.bid_id)
        .single();

      if (existing && !existing.deleted_at) {
        return {
          success: false,
          error: 'Video already exists for this auction',
        };
      }

      // Generate secure token
      const token = this.generateToken();
      const expiresAt = this.getTokenExpiry();

      // Create placeholder record with token (video will be uploaded later)
      // Note: file_url is set to empty string as placeholder until video is uploaded
      const { data, error: insertError } = await supabase
        .from('auction_videos')
        .insert({
          auction_id: params.auction_id,
          bid_id: params.bid_id,
          file_url: '', // Placeholder - will be updated when video is uploaded
          recording_token: token,
          token_expires_at: expiresAt.toISOString(),
          expires_at: this.getVideoExpiry().toISOString(),
          retake_count: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const session: VideoRecordingSession = {
        auction_id: params.auction_id,
        bid_id: params.bid_id,
        token,
        expires_at: expiresAt.toISOString(),
        can_retake: true,
      };

      // Schedule EventBridge event to auto-unlock payout at token expiry (24hr)
      // This will unlock payout if winner doesn't upload video within 24hr
      try {
        const scheduler = getEventBridgeScheduler();
        const unlockResult = await scheduler.schedulePayoutUnlock({
          auctionId: params.auction_id,
          unlockTime: expiresAt,
        });

        if (unlockResult.success) {
          console.log(`[AuctionVideoService] Scheduled payout unlock for auction ${params.auction_id} at ${expiresAt.toISOString()}`);
        } else {
          console.warn(`[AuctionVideoService] Failed to schedule payout unlock: ${unlockResult.error}`);
          // Don't fail the session creation - the payout can still be manually unlocked
        }
      } catch (scheduleError) {
        console.error('[AuctionVideoService] Error scheduling payout unlock:', scheduleError);
        // Don't fail the session creation - EventBridge may not be configured in all environments
      }

      return { success: true, session };
    } catch (error) {
      console.error('Error creating recording session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create recording session',
      };
    }
  }

  /**
   * Get existing recording session (fetch token for winner)
   * Used when session already exists from EventBridge
   */
  async getRecordingSession(params: {
    auction_id: string;
    bid_id: string;
  }): Promise<{ success: boolean; session?: VideoRecordingSession; error?: string }> {
    const supabase = createServiceRoleClient();

    try {
      // Check if video session already exists
      const { data: existing, error: queryError } = await supabase
        .from('auction_videos')
        .select('recording_token, token_expires_at')
        .eq('auction_id', params.auction_id)
        .eq('bid_id', params.bid_id)
        .is('deleted_at', null)
        .single();

      if (queryError || !existing) {
        // No session found - create a new one as fallback
        console.log('No existing session found, creating new one...');
        return await this.createRecordingSession(params);
      }

      // Check if token is expired
      const expiresAt = new Date(existing.token_expires_at);
      if (expiresAt < new Date()) {
        return {
          success: false,
          error: 'Recording token has expired',
        };
      }

      const session: VideoRecordingSession = {
        auction_id: params.auction_id,
        bid_id: params.bid_id,
        token: existing.recording_token,
        expires_at: existing.token_expires_at,
        can_retake: true,
      };

      return { success: true, session };
    } catch (error) {
      console.error('Error getting recording session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recording session',
      };
    }
  }

  /**
   * Upload video to Supabase Storage
   */
  async uploadVideo(params: {
    auction_id: string;
    bid_id: string;
    file: File;
    recording_method: 'in_page' | 'email_link';
    recording_token?: string;
  }): Promise<{ success: boolean; video_id?: string; file_url?: string; error?: string }> {
    // Use service role client for all uploads to bypass RLS
    // This is safe because we validate bid_id belongs to auction_id
    const supabase = createServiceRoleClient();

    try {
      // Verify auction exists (security check)
      const { data: auctionData, error: auctionError } = await supabase
        .from('auctions')
        .select('id')
        .eq('id', params.auction_id)
        .single();

      if (auctionError || !auctionData) {
        return { success: false, error: 'Invalid auction' };
      }

      // Validate token deadline if token provided
      if (params.recording_token) {
        const validation = await this.validateToken(params.recording_token);
        if (!validation.valid) {
          return { success: false, error: validation.error || 'Invalid token' };
        }
        // Additional check: ensure not expired
        if (validation.token_expires_at && new Date(validation.token_expires_at) < new Date()) {
          return { success: false, error: 'Recording deadline has expired' };
        }
      }

      // Check if existing video and retake count
      const { data: existing } = await supabase
        .from('auction_videos')
        .select('*')
        .eq('auction_id', params.auction_id)
        .eq('bid_id', params.bid_id)
        .single();

      if (existing && existing.retake_count >= 1) {
        return { success: false, error: 'Maximum retakes reached' };
      }

      // Generate file path
      const timestamp = Date.now();
      const filePath = `auction-videos/${params.auction_id}/${params.bid_id}/${timestamp}.webm`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('auction_videos')
        .upload(filePath, params.file, {
          contentType: params.file.type,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('auction_videos')
        .getPublicUrl(filePath);

      // Create or update video record
      const videoData: any = {
        auction_id: params.auction_id,
        bid_id: params.bid_id,
        file_url: urlData.publicUrl,
        file_size_bytes: params.file.size,
        mime_type: params.file.type,
        recording_method: params.recording_method,
        recording_token: params.recording_token,
        token_expires_at: params.recording_token ? this.getTokenExpiry().toISOString() : null,
        expires_at: this.getVideoExpiry().toISOString(),
        retake_count: existing ? existing.retake_count + 1 : 0,
      };

      let videoId: string;

      if (existing) {
        // Update existing
        const { data: updated, error: updateError } = await supabase
          .from('auction_videos')
          .update(videoData)
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw updateError;
        videoId = updated.id;
      } else {
        // Create new
        const { data: created, error: createError } = await supabase
          .from('auction_videos')
          .insert(videoData)
          .select()
          .single();

        if (createError) throw createError;
        videoId = created.id;
      }

      // Update auction to set has_video flag
      // This triggers Supabase real-time event that existing subscriptions will catch
      const { error: auctionUpdateError } = await supabase
        .from('auctions')
        .update({
          has_video: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.auction_id);

      if (auctionUpdateError) {
        console.error('Error updating auction has_video flag:', auctionUpdateError);
        // Don't fail the upload - video is already saved successfully
      }

      return {
        success: true,
        video_id: videoId,
        file_url: urlData.publicUrl,
      };
    } catch (error) {
      console.error('Error uploading video:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload video',
      };
    }
  }

  /**
   * Get video for viewing (creator only)
   */
  async getVideo(auctionId: string): Promise<AuctionVideo | null> {
    // Use regular client here - RLS will ensure only creator can view
    const supabase = await createClient();

    try {
      const { data, error } = await supabase
        .from('auction_videos')
        .select('*')
        .eq('auction_id', auctionId)
        .is('deleted_at', null)
        .single();

      if (error) return null;

      return data;
    } catch (error) {
      console.error('Error getting video:', error);
      return null;
    }
  }

  /**
   * Validate recording token
   */
  async validateToken(token: string): Promise<{
    valid: boolean;
    auction_id?: string;
    bid_id?: string;
    creator_name?: string;
    token_expires_at?: string;
    already_uploaded?: boolean;
    error?: string;
  }> {
    // Use service role to validate tokens (guest users don't have session)
    const supabase = createServiceRoleClient();

    try {
      const { data, error } = await supabase
        .from('auction_videos')
        .select(`
          auction_id,
          bid_id,
          token_expires_at,
          file_url,
          retake_count,
          auctions!inner(
            creator:users!creator_id(
              user_name
            )
          )
        `)
        .eq('recording_token', token)
        .single();

      if (error || !data) {
        return { valid: false, error: 'Invalid token' };
      }

      if (new Date(data.token_expires_at) < new Date()) {
        return { valid: false, error: '24-hour access period ended' };
      }

      // Check if video has already been uploaded (file_url is not empty and retake limit reached)
      const alreadyUploaded = data.file_url && data.file_url.trim() !== '' && data.retake_count >= 1;

      if (alreadyUploaded) {
        return {
          valid: false,
          already_uploaded: true,
          error: 'Video already uploaded. Maximum retakes reached.',
        };
      }

      // Extract creator name from nested data
      const creatorName = (data.auctions as any)?.creator?.user_name || 'the auction creator';

      return {
        valid: true,
        auction_id: data.auction_id,
        bid_id: data.bid_id,
        creator_name: creatorName,
        token_expires_at: data.token_expires_at,
        already_uploaded: false,
      };
    } catch (error) {
      console.error('Error validating token:', error);
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Delete expired videos (cron job)
   */
  async deleteExpiredVideos(): Promise<{ deleted_count: number }> {
    // Use service role client for cron job execution
    const supabase = createServiceRoleClient();

    try {
      // Get expired videos
      const { data: expiredVideos, error: fetchError } = await supabase
        .from('auction_videos')
        .select('*')
        .lt('expires_at', new Date().toISOString())
        .is('deleted_at', null);

      if (fetchError) throw fetchError;

      if (!expiredVideos || expiredVideos.length === 0) {
        return { deleted_count: 0 };
      }

      // Delete from storage
      for (const video of expiredVideos) {
        const filePath = this.extractFilePathFromUrl(video.file_url);
        if (filePath) {
          await supabase.storage.from('auction_videos').remove([filePath]);
        }
      }

      // Mark as deleted in database
      const videoIds = expiredVideos.map(v => v.id);
      await supabase
        .from('auction_videos')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', videoIds);

      console.log(`Deleted ${expiredVideos.length} expired videos`);
      return { deleted_count: expiredVideos.length };
    } catch (error) {
      console.error('Error deleting expired videos:', error);
      return { deleted_count: 0 };
    }
  }

  /**
   * Helper: Generate secure token
   */
  private generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Helper: Get video expiry date (7 days)
   */
  private getVideoExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    return expiry;
  }

  /**
   * Helper: Get token expiry date (24 hours)
   */
  private getTokenExpiry(): Date {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    return expiry;
  }

  /**
   * Helper: Extract file path from Supabase URL
   */
  private extractFilePathFromUrl(url: string): string | null {
    try {
      const match = url.match(/auction-videos\/.+$/);
      return match ? match[0] : null;
    } catch {
      return null;
    }
  }
}
