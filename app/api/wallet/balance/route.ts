// API endpoint for wallet balance checking
// GET /api/wallet/balance - Get user's wallet balance and pending amounts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { crossmintService } from '@/lib/crossmint';
import { crossmintDB } from '@/lib/crossmint-db';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get user with wallet information
    const user = await crossmintDB.getUserWithWallet(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.wallet_address) {
      return NextResponse.json({
        success: true,
        data: {
          hasWallet: false,
          message: 'User does not have a crypto wallet yet',
          walletSetupRequired: true
        }
      });
    }

    console.log(`🔄 Checking wallet balance for user: ${user.email}`);

    // Get on-chain wallet balance (if Crossmint provides this API)
    let onChainBalance = null;
    try {
      // Note: This would use Crossmint's wallet balance API when available
      // const walletBalance = await crossmintService.getWalletBalance(user.crossmint_wallet_id);
      // onChainBalance = walletBalance;
    } catch (balanceError) {
      console.log('⚠️ Could not fetch on-chain balance:', balanceError);
    }

    // Calculate balance from transaction history
    const transactionBalance = await calculateTransactionBalance(userId);

    // Get pending transactions
    const pendingAmounts = await calculatePendingAmounts(userId);

    // Get recent transaction activity
    const recentTransactions = await getRecentTransactionSummary(userId);

    return NextResponse.json({
      success: true,
      data: {
        hasWallet: true,
        walletAddress: user.wallet_address,
        crossmintWalletId: user.crossmint_wallet_id,
        balance: {
          // On-chain balance (from Crossmint API)
          onChain: onChainBalance,
          // Calculated balance from our transaction records
          calculated: transactionBalance,
          // Pending amounts not yet settled
          pending: pendingAmounts
        },
        recentActivity: recentTransactions,
        summary: {
          totalEarnings: transactionBalance.totalReceived,
          totalTransferred: transactionBalance.totalTransferred,
          pendingTransfers: pendingAmounts.transfersPending,
          availableBalance: transactionBalance.available
        },
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Wallet balance check error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check wallet balance'
    }, { status: 500 });
  }
}

async function calculateTransactionBalance(userId: string) {
  try {
    // Get all completed transactions for the user
    const { data: transactions, error } = await supabase
      .from('wallet_transactions')
      .select('transaction_type, status, amount_usdc, amount_aed')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (error) {
      throw new Error(`Failed to get transactions: ${error.message}`);
    }

    let totalReceived = 0;
    let totalTransferred = 0;
    let feesCollected = 0;

    transactions?.forEach(tx => {
      const amountUsdc = tx.amount_usdc || 0;
      
      switch (tx.transaction_type) {
        case 'payment_received':
          totalReceived += amountUsdc;
          break;
        case 'transfer_out':
          totalTransferred += amountUsdc;
          break;
        case 'fee_collected':
          feesCollected += amountUsdc;
          break;
      }
    });

    // Available balance = received - transferred
    const available = totalReceived - totalTransferred;

    return {
      totalReceived: {
        usdc: totalReceived,
        display: `${totalReceived.toFixed(2)} USDC`
      },
      totalTransferred: {
        usdc: totalTransferred,
        display: `${totalTransferred.toFixed(2)} USDC`
      },
      feesCollected: {
        usdc: feesCollected,
        display: `${feesCollected.toFixed(2)} USDC`
      },
      available: {
        usdc: available,
        display: `${available.toFixed(2)} USDC`
      },
      lastCalculated: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error calculating transaction balance:', error);
    throw error;
  }
}

async function calculatePendingAmounts(userId: string) {
  try {
    // Get pending payment transactions
    const { data: pendingPayments, error: paymentsError } = await supabase
      .from('wallet_transactions')
      .select('amount_usdc, amount_aed, transaction_type, created_at')
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (paymentsError) {
      throw new Error(`Failed to get pending payments: ${paymentsError.message}`);
    }

    let paymentsPending = 0;
    let transfersPending = 0;
    let oldestPendingDate: Date | null = null;

    pendingPayments?.forEach(tx => {
      const amountUsdc = tx.amount_usdc || 0;
      
      if (tx.transaction_type === 'payment_received') {
        paymentsPending += amountUsdc;
      } else if (tx.transaction_type === 'transfer_out') {
        transfersPending += amountUsdc;
      }

      // Track oldest pending transaction
      if (!oldestPendingDate || tx.created_at < oldestPendingDate) {
        oldestPendingDate = tx.created_at;
      }
    });

    return {
      paymentsPending: {
        usdc: paymentsPending,
        display: `${paymentsPending.toFixed(2)} USDC`
      },
      transfersPending: {
        usdc: transfersPending,
        display: `${transfersPending.toFixed(2)} USDC`
      },
      totalPending: {
        usdc: paymentsPending + transfersPending,
        display: `${(paymentsPending + transfersPending).toFixed(2)} USDC`
      },
      pendingCount: pendingPayments?.length || 0,
      oldestPendingDate
    };

  } catch (error) {
    console.error('❌ Error calculating pending amounts:', error);
    throw error;
  }
}

async function getRecentTransactionSummary(userId: string) {
  try {
    // Get recent transactions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentTxs, error } = await supabase
      .from('wallet_transactions')
      .select(`
        transaction_type,
        status,
        amount_usdc,
        created_at,
        payment_links (title, client_name)
      `)
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to get recent transactions: ${error.message}`);
    }

    // Calculate recent activity stats
    let recentEarnings = 0;
    let recentTransfers = 0;
    let recentTransactionCount = 0;

    recentTxs?.forEach(tx => {
      if (tx.status === 'completed') {
        const amount = tx.amount_usdc || 0;
        
        if (tx.transaction_type === 'payment_received') {
          recentEarnings += amount;
          recentTransactionCount++;
        } else if (tx.transaction_type === 'transfer_out') {
          recentTransfers += amount;
        }
      }
    });

    return {
      last30Days: {
        earnings: {
          usdc: recentEarnings,
          display: `${recentEarnings.toFixed(2)} USDC`
        },
        transfers: {
          usdc: recentTransfers,
          display: `${recentTransfers.toFixed(2)} USDC`
        },
        transactionCount: recentTransactionCount
      },
      recentTransactions: recentTxs?.slice(0, 5).map(tx => ({
        type: tx.transaction_type,
        status: tx.status,
        amount: tx.amount_usdc ? `${tx.amount_usdc.toFixed(2)} USDC` : '0.00 USDC',
        description: tx.payment_links?.title || tx.transaction_type,
        date: tx.created_at
      })) || []
    };

  } catch (error) {
    console.error('❌ Error getting recent transaction summary:', error);
    throw error;
  }
}