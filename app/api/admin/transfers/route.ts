// Admin API for managing transfers and marketplace monitoring
// GET /api/admin/transfers - Get transfer overview and failed transfers
// POST /api/admin/transfers/retry - Retry failed transfers

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { transferService } from '@/lib/transfer-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
) as any;

// GET - Admin transfer overview
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId');

    // Verify admin access (simplified - in production, use proper auth middleware)
    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', adminUserId)
      .single();

    if (adminError || !admin || admin.role !== 'Admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log('🔧 Admin transfer overview requested');

    // Get transfer statistics
    const [
      pendingTransfers,
      failedTransfers,
      pendingAmounts,
      marketplaceStats
    ] = await Promise.all([
      transferService.getPendingTransfers(),
      transferService.getFailedTransfers(),
      transferService.calculatePendingTransferAmounts(),
      getMarketplaceStats()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          pendingTransfers: pendingTransfers.length,
          failedTransfers: failedTransfers.length,
          totalPendingUsdc: pendingAmounts.totalPendingUsdc,
          totalPendingAed: pendingAmounts.totalPendingAed
        },
        pendingTransfers: pendingTransfers.map(formatTransferForAdmin),
        failedTransfers: failedTransfers.map(formatTransferForAdmin),
        marketplaceStats,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Admin transfer overview error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get transfer overview'
    }, { status: 500 });
  }
}

// POST - Retry failed transfers or manual operations
export async function POST(request: NextRequest) {
  try {
    const { action, transactionId, crossmintTransactionId, adminUserId } = await request.json();

    // Verify admin access
    if (!adminUserId) {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 401 }
      );
    }

    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', adminUserId)
      .single();

    if (adminError || !admin || admin.role !== 'Admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log(`🔧 Admin action: ${action} for transaction: ${transactionId}`);

    switch (action) {
      case 'retry_transfer':
        if (!transactionId) {
          return NextResponse.json(
            { error: 'Transaction ID required for retry' },
            { status: 400 }
          );
        }

        const retryResult = await transferService.retryFailedTransfer(transactionId);
        
        if (retryResult.success) {
          return NextResponse.json({
            success: true,
            message: 'Transfer retry initiated successfully',
            data: {
              transactionId: retryResult.transactionId,
              transferId: retryResult.transferId
            }
          });
        } else {
          return NextResponse.json({
            success: false,
            error: retryResult.error
          }, { status: 500 });
        }

      case 'manual_complete':
        if (!transactionId || !crossmintTransactionId) {
          return NextResponse.json(
            { error: 'Transaction ID and Crossmint transaction ID required' },
            { status: 400 }
          );
        }

        await transferService.manuallyCompleteTransfer(
          transactionId,
          crossmintTransactionId,
          adminUserId
        );

        return NextResponse.json({
          success: true,
          message: 'Transfer manually completed successfully'
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('❌ Admin transfer action error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute admin action'
    }, { status: 500 });
  }
}

function formatTransferForAdmin(transfer: any) {
  const user = transfer.users;
  const paymentLink = transfer.payment_links;
  
  return {
    id: transfer.id,
    status: transfer.status,
    amount: {
      usdc: transfer.amount_usdc,
      aed: transfer.amount_aed,
      display: transfer.amount_usdc ? `${transfer.amount_usdc.toFixed(2)} USDC` : 'N/A'
    },
    professional: {
      id: user?.id,
      name: user?.user_name,
      email: user?.email,
      walletAddress: user?.wallet_address
    },
    paymentLink: {
      id: paymentLink?.id,
      title: paymentLink?.title,
      clientName: paymentLink?.client_name,
      originalAmount: paymentLink?.service_amount_aed
    },
    crossmintTransactionId: transfer.crossmint_transaction_id,
    error: transfer.metadata?.error,
    requiresManualIntervention: transfer.metadata?.requires_manual_intervention,
    retryCount: transfer.metadata?.retry_count || 0,
    createdAt: transfer.created_at,
    updatedAt: transfer.updated_at,
    metadata: transfer.metadata
  };
}

async function getMarketplaceStats() {
  try {
    // Get marketplace revenue (fees collected)
    const { data: feeTransactions, error: feeError } = await supabase
      .from('wallet_transactions')
      .select('amount_usdc, amount_aed')
      .eq('transaction_type', 'fee_collected')
      .eq('status', 'completed');

    if (feeError) {
      throw new Error(`Failed to get fee transactions: ${feeError.message}`);
    }

    // Get total payments processed
    const { data: paymentTransactions, error: paymentError } = await supabase
      .from('wallet_transactions')
      .select('amount_usdc, amount_aed')
      .eq('transaction_type', 'payment_received')
      .eq('status', 'completed');

    if (paymentError) {
      throw new Error(`Failed to get payment transactions: ${paymentError.message}`);
    }

    // Get active users with wallets
    const { data: activeUsers, error: usersError } = await supabase
      .from('users')
      .select('id')
      .not('wallet_address', 'is', null);

    if (usersError) {
      throw new Error(`Failed to get active users: ${usersError.message}`);
    }

    // Calculate totals
    const totalFeesUsdc = feeTransactions?.reduce((sum, tx) => sum + (tx.amount_usdc || 0), 0) || 0;
    const totalPaymentsUsdc = paymentTransactions?.reduce((sum, tx) => sum + (tx.amount_usdc || 0), 0) || 0;

    return {
      totalMarketplaceFees: {
        usdc: totalFeesUsdc,
        display: `${totalFeesUsdc.toFixed(2)} USDC`
      },
      totalPaymentsProcessed: {
        usdc: totalPaymentsUsdc,
        display: `${totalPaymentsUsdc.toFixed(2)} USDC`
      },
      activeUsersWithWallets: activeUsers?.length || 0,
      transactionCounts: {
        totalFeeTransactions: feeTransactions?.length || 0,
        totalPaymentTransactions: paymentTransactions?.length || 0
      },
      averageTransactionSize: paymentTransactions?.length ? 
        (totalPaymentsUsdc / paymentTransactions.length).toFixed(2) : '0.00'
    };

  } catch (error) {
    console.error('❌ Error getting marketplace stats:', error);
    throw error;
  }
}