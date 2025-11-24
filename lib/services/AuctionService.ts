/**
 * Auction Service
 * Handles CRUD operations and business logic for auctions
 */

import { createClient } from '@/utils/supabase/server';
import type {
  Auction,
  CreateAuctionDto,
  UpdateAuctionDto,
  AuctionStatus,
  getAuctionEndTime,
} from '@/lib/models/Auction.model';
import { getEventBridgeScheduler } from './EventBridgeScheduler';

export class AuctionService {
  /**
   * Create a new auction
   */
  async createAuction(dto: CreateAuctionDto): Promise<{ success: boolean; auction_id?: string; error?: string }> {
    const supabase = await createClient();

    try {
      console.log('🔧 [AuctionService] createAuction called with DTO:', dto);

      // Calculate end time based on duration
      const startTime = dto.start_time ? new Date(dto.start_time) : new Date();
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + dto.duration);

      console.log('⏰ [AuctionService] Calculated times:', {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: dto.duration
      });

      // Build insert object with only defined fields
      const insertData: any = {
        creator_id: dto.creator_id,
        title: dto.title,
        auction_start_price: dto.auction_start_price,
        auction_current_price: 0,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration: dto.duration,
        status: 'pending',
      };

      // Only add optional fields if they're defined
      if (dto.description !== undefined && dto.description !== null) {
        insertData.description = dto.description;
        console.log('📝 [AuctionService] Adding description field');
      }
      if (dto.auction_buy_now_price !== undefined && dto.auction_buy_now_price !== null) {
        insertData.auction_buy_now_price = dto.auction_buy_now_price;
        console.log('💰 [AuctionService] Adding auction_buy_now_price field');
      }

      console.log('📤 [AuctionService] Inserting data to Supabase:', insertData);

      const { data, error } = await supabase
        .from('auctions')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('❌ [AuctionService] Supabase insert error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
        throw error;
      }

      console.log('✅ [AuctionService] Auction created successfully:', {
        auctionId: data.id,
        title: data.title
      });

      return { success: true, auction_id: data.id };
    } catch (error) {
      console.error('💥 [AuctionService] Error creating auction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create auction',
      };
    }
  }

  /**
   * Get auction by ID
   */
  async getAuction(auctionId: string): Promise<Auction | null> {
    const supabase = await createClient();

    try {
      console.log('🔧 [AuctionService] getAuction called with ID:', auctionId);

      const { data, error } = await supabase
        .from('auctions')
        .select(`
          *,
          creator:users!creator_id(id, email, user_name, role, profile_photo_url, instagram_handle)
        `)
        .eq('id', auctionId)
        .single();

      console.log('📤 [AuctionService] Supabase query result:', {
        hasData: !!data,
        hasError: !!error,
        auctionId: data?.id,
        status: data?.status
      });

      if (error) {
        console.error('❌ [AuctionService] Supabase error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('✅ [AuctionService] Auction retrieved:', data.id);
      return data;
    } catch (error) {
      console.error('💥 [AuctionService] Error getting auction:', error);
      return null;
    }
  }

  /**
   * List auctions with filters
   */
  async listAuctions(filters?: {
    status?: AuctionStatus;
    creator_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Auction[]> {
    const supabase = await createClient();

    try {
      let query = supabase
        .from('auctions')
        .select(`
          *,
          creator:users!creator_id(id, email, user_name, role, profile_photo_url)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.creator_id) {
        query = query.eq('creator_id', filters.creator_id);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error listing auctions:', error);
      return [];
    }
  }

  /**
   * Update auction
   */
  async updateAuction(
    auctionId: string,
    dto: UpdateAuctionDto
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    try {
      const { error } = await supabase
        .from('auctions')
        .update({ ...dto, updated_at: new Date().toISOString() })
        .eq('id', auctionId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error updating auction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update auction',
      };
    }
  }

  /**
   * Start an auction (change status to active)
   */
  async startAuction(auctionId: string): Promise<{ success: boolean; error?: string }> {
    return await this.updateAuction(auctionId, { status: 'active' });
  }

  /**
   * End an auction
   */
  async endAuction(auctionId: string, winnerBidId?: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    try {
      const updateData: any = {
        status: 'ended',
        updated_at: new Date().toISOString(),
      };

      if (winnerBidId) {
        // Get winner information
        const { data: winnerBid } = await supabase
          .from('bids')
          .select('bidder_name, bidder_email, bidder_instagram_username')
          .eq('id', winnerBidId)
          .single();

        if (winnerBid) {
          updateData.winner_bid_id = winnerBidId;
          updateData.winner_name = winnerBid.bidder_name;
          updateData.winner_email = winnerBid.bidder_email;
          updateData.winner_instagram_username = winnerBid.bidder_instagram_username;
        }
      }

      const { error } = await supabase
        .from('auctions')
        .update(updateData)
        .eq('id', auctionId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error ending auction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to end auction',
      };
    }
  }

  /**
   * Mark auction as completed (after payment captured)
   */
  async completeAuction(auctionId: string): Promise<{ success: boolean; error?: string }> {
    return await this.updateAuction(auctionId, {
      status: 'completed',
      payment_captured_at: new Date().toISOString(),
    });
  }

  /**
   * Cancel an auction
   */
  async cancelAuction(auctionId: string): Promise<{ success: boolean; error?: string }> {
    return await this.updateAuction(auctionId, { status: 'cancelled' });
  }

  /**
   * Extend auction time (anti-sniping)
   */
  async extendAuctionTime(auctionId: string, extensionSeconds: number): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    try {
      const { data: auction, error: fetchError } = await supabase
        .from('auctions')
        .select('end_time, scheduler_event_id')
        .eq('id', auctionId)
        .single();

      if (fetchError) throw fetchError;

      const oldSchedulerId = auction.scheduler_event_id;
      const newEndTime = new Date(auction.end_time);
      newEndTime.setSeconds(newEndTime.getSeconds() + extensionSeconds);

      // Update EventBridge schedule if it exists
      let newSchedulerId = oldSchedulerId;
      if (oldSchedulerId) {
        try {
          console.log(`[Anti-Sniping] Updating EventBridge schedule for auction ${auctionId}`);
          const scheduler = getEventBridgeScheduler();
          const scheduleResult = await scheduler.updateSchedule(
            auctionId,
            oldSchedulerId,
            newEndTime
          );

          if (scheduleResult.success && scheduleResult.schedulerEventId) {
            newSchedulerId = scheduleResult.schedulerEventId;
            console.log(`[Anti-Sniping] EventBridge schedule updated: ${newSchedulerId}`);
          } else {
            console.error(`[Anti-Sniping] Failed to update EventBridge schedule:`, scheduleResult.error);
          }
        } catch (scheduleError) {
          console.error('[Anti-Sniping] Error updating EventBridge schedule:', scheduleError);
          // Don't fail the extension if EventBridge update fails
        }
      }

      // Update auction in database
      const { error } = await supabase
        .from('auctions')
        .update({
          end_time: newEndTime.toISOString(),
          scheduler_event_id: newSchedulerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', auctionId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error extending auction time:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extend auction time',
      };
    }
  }

  /**
   * Get active auctions (for cron job processing)
   */
  async getActiveAuctions(): Promise<Auction[]> {
    const supabase = await createClient();

    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('status', 'active')
        .lte('end_time', new Date().toISOString());

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting active auctions:', error);
      return [];
    }
  }

  /**
   * Get auctions that need to start
   */
  async getAuctionsToStart(): Promise<Auction[]> {
    const supabase = await createClient();

    try {
      const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('status', 'pending')
        .lte('start_time', new Date().toISOString());

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting auctions to start:', error);
      return [];
    }
  }

  /**
   * Delete an auction (only if no bids)
   */
  async deleteAuction(auctionId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    try {
      // Check if there are any bids
      const { data: bids } = await supabase
        .from('bids')
        .select('id')
        .eq('auction_id', auctionId)
        .limit(1);

      if (bids && bids.length > 0) {
        return { success: false, error: 'Cannot delete auction with existing bids' };
      }

      const { error } = await supabase
        .from('auctions')
        .delete()
        .eq('id', auctionId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error deleting auction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete auction',
      };
    }
  }
}
