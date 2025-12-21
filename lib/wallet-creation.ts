// Wallet creation service for new users
// Handles automatic wallet creation during user registration

import { crossmintService } from '@/lib/crossmint';
import { crossmintDB } from '@/lib/crossmint-db';
import { createServiceRoleClient } from '@/utils/supabase/service-role';

export interface WalletCreationResult {
  success: boolean;
  walletAddress?: string;
  walletId?: string;
  error?: string;
}

export class WalletCreationService {
  
  /**
   * Create wallet for new user during signup process
   */
  async createWalletForUser(
    userId: string,
    userEmail: string,
    retryCount: number = 0
  ): Promise<WalletCreationResult> {
    const maxRetries = 3;
    
    try {
      console.log(`🔄 Creating wallet for user: ${userEmail}`);
      
      // Check if user already has a wallet
      const existingUser = await crossmintDB.getUserWithWallet(userId);
      if (existingUser?.wallet_address) {
        console.log(`✅ User already has wallet: ${existingUser.wallet_address}`);
        return {
          success: true,
          walletAddress: existingUser.wallet_address,
          walletId: existingUser.crossmint_wallet_id || undefined
        };
      }

      // Create wallet via Crossmint
      const walletResponse = await crossmintService.createWallet(userEmail);
      
      console.log(`✅ Crossmint wallet created:`, {
        id: walletResponse.id,
        address: walletResponse.address
      });

      // Update user record in database
      await crossmintDB.updateUserWallet(
        userId,
        walletResponse.address,
        walletResponse.id
      );

      // Record wallet creation transaction
      await crossmintDB.recordTransaction({
        user_id: userId,
        transaction_type: 'wallet_created',
        status: 'completed',
        metadata: {
          wallet_address: walletResponse.address,
          crossmint_wallet_id: walletResponse.id,
          created_via: 'signup_process'
        }
      });

      console.log(`✅ Wallet creation completed for user: ${userEmail}`);
      
      return {
        success: true,
        walletAddress: walletResponse.address,
        walletId: walletResponse.id
      };

    } catch (error) {
      console.error(`❌ Wallet creation failed for user ${userEmail}:`, error);
      
      // Retry logic for transient failures
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying wallet creation (${retryCount + 1}/${maxRetries})...`);
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.createWalletForUser(userId, userEmail, retryCount + 1);
      }

      // Record failed attempt
      try {
        await crossmintDB.recordTransaction({
          user_id: userId,
          transaction_type: 'wallet_created',
          status: 'failed',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            retry_count: retryCount,
            failed_at: new Date().toISOString()
          }
        });
      } catch (dbError) {
        console.error('Failed to record wallet creation failure:', dbError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown wallet creation error'
      };
    }
  }

  /**
   * Retry wallet creation for users who don't have wallets yet
   */
  async retryWalletCreationForUser(userId: string): Promise<WalletCreationResult> {
    try {
      const user = await crossmintDB.getUserWithWallet(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      if (user.wallet_address) {
        return {
          success: true,
          walletAddress: user.wallet_address,
          walletId: user.crossmint_wallet_id || undefined
        };
      }

      return this.createWalletForUser(userId, user.email);
      
    } catch (error) {
      console.error('Retry wallet creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Retry failed'
      };
    }
  }

  /**
   * Check wallet creation status for a user
   */
  async checkWalletStatus(userId: string): Promise<{
    hasWallet: boolean;
    walletAddress?: string;
    walletId?: string;
    createdAt?: string;
  }> {
    try {
      const user = await crossmintDB.getUserWithWallet(userId);
      
      return {
        hasWallet: !!user?.wallet_address,
        walletAddress: user?.wallet_address || undefined,
        walletId: user?.crossmint_wallet_id || undefined,
        createdAt: user?.wallet_created_at || undefined
      };
    } catch (error) {
      console.error('Check wallet status failed:', error);
      return { hasWallet: false };
    }
  }

  /**
   * Bulk create wallets for existing users without wallets
   */
  async createWalletsForExistingUsers(): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{ userId: string; email: string; success: boolean; error?: string; }>;
  }> {
    const supabase = createServiceRoleClient();
    try {
      // Get users without wallets
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email')
        .is('wallet_address', null);

      if (error) {
        throw new Error(`Failed to get users without wallets: ${error.message}`);
      }

      if (!users || users.length === 0) {
        return {
          total: 0,
          successful: 0,
          failed: 0,
          results: []
        };
      }

      console.log(`🔄 Creating wallets for ${users.length} existing users...`);

      const results = [];
      let successful = 0;
      let failed = 0;

      // Process users in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (user) => {
          const result = await this.createWalletForUser(user.id, user.email);
          
          if (result.success) {
            successful++;
          } else {
            failed++;
          }

          return {
            userId: user.id,
            email: user.email,
            success: result.success,
            error: result.error
          };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add delay between batches
        if (i + batchSize < users.length) {
          await this.delay(2000);
        }
      }

      console.log(`✅ Bulk wallet creation completed: ${successful} successful, ${failed} failed`);

      return {
        total: users.length,
        successful,
        failed,
        results
      };

    } catch (error) {
      console.error('Bulk wallet creation failed:', error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const walletCreationService = new WalletCreationService();

// Export for API routes
export async function createWalletForNewUser(userId: string, userEmail: string): Promise<WalletCreationResult> {
  return walletCreationService.createWalletForUser(userId, userEmail);
}