// API endpoint for wallet transactions
// GET /api/wallet/transactions - Get user's wallet transaction history

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { crossmintDB } from '@/lib/crossmint-db';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status'); // filter by status
    const type = searchParams.get('type'); // filter by transaction type

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, wallet_address')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log(`🔄 Fetching transactions for user: ${user.email}`);

    // Build query with filters
    let query = supabase
      .from('wallet_transactions')
      .select(`
        *,
        payment_links (
          id,
          title,
          client_name,
          original_amount_aed,
          total_amount_aed
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('transaction_type', type);
    }

    const { data: transactions, error: transactionsError } = await query;

    if (transactionsError) {
      throw new Error(`Failed to fetch transactions: ${transactionsError.message}`);
    }

    // Get transaction summary
    const summary = await crossmintDB.getUserTransactionSummary(userId);

    // Format transactions for display
    const formattedTransactions = transactions?.map(tx => {
      const paymentLink = tx.payment_links;
      
      return {
        id: tx.id,
        type: tx.transaction_type,
        status: tx.status,
        amount: {
          usdc: tx.amount_usdc,
          aed: tx.amount_aed,
          display: formatAmountDisplay(tx.amount_usdc, tx.amount_aed, tx.transaction_type)
        },
        description: getTransactionDescription(tx, paymentLink),
        paymentLink: paymentLink ? {
          id: paymentLink.id,
          title: paymentLink.title,
          clientName: paymentLink.client_name,
          originalAmount: paymentLink.original_amount_aed,
          totalAmount: paymentLink.total_amount_aed
        } : null,
        crossmintTransactionId: tx.crossmint_transaction_id,
        metadata: tx.metadata,
        createdAt: tx.created_at,
        completedAt: tx.completed_at,
        updatedAt: tx.updated_at
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.full_name,
          walletAddress: user.wallet_address
        },
        transactions: formattedTransactions,
        summary: {
          totalTransactions: summary.total_transactions,
          totalReceived: {
            usdc: summary.total_received_usdc,
            display: `${summary.total_received_usdc.toFixed(2)} USDC`
          },
          totalTransferred: {
            usdc: summary.total_transferred_usdc,
            display: `${summary.total_transferred_usdc.toFixed(2)} USDC`
          },
          totalFees: {
            usdc: summary.total_fees_usdc,
            display: `${summary.total_fees_usdc.toFixed(2)} USDC`
          },
          lastTransactionAt: summary.last_transaction_at
        },
        pagination: {
          limit,
          offset,
          hasMore: transactions?.length === limit
        }
      }
    });

  } catch (error) {
    console.error('❌ Get wallet transactions error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get wallet transactions'
    }, { status: 500 });
  }
}

function formatAmountDisplay(amountUsdc: number | null, amountAed: number | null, type: string): string {
  // Prioritize USDC for display, fall back to AED
  if (amountUsdc && amountUsdc > 0) {
    return `${amountUsdc.toFixed(2)} USDC`;
  }
  if (amountAed && amountAed > 0) {
    return `AED ${amountAed.toFixed(2)}`;
  }
  return '0.00';
}

function getTransactionDescription(transaction: any, paymentLink: any): string {
  const type = transaction.transaction_type;
  const status = transaction.status;
  
  switch (type) {
    case 'payment_received':
      if (paymentLink) {
        const clientName = paymentLink.client_name || 'Customer';
        return `Payment received from ${clientName} for ${paymentLink.title}`;
      }
      return 'Payment received';
    
    case 'transfer_out':
      if (status === 'completed') {
        return 'Payout transferred to your wallet';
      } else if (status === 'pending') {
        return 'Payout transfer in progress';
      } else {
        return 'Payout transfer failed';
      }
    
    case 'fee_collected':
      return 'Marketplace fee collected';
    
    case 'refund_issued':
      if (paymentLink) {
        return `Refund issued for ${paymentLink.title}`;
      }
      return 'Refund issued';
    
    case 'wallet_created':
      return 'Crypto wallet created';
    
    default:
      return `Transaction: ${type}`;
  }
}