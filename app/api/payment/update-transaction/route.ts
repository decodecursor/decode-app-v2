import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { emailService } from '@/lib/email-service';

// Helper function to send payment notification
async function sendPaymentNotification(transaction: any, paymentLink: any) {
  try {
    // Get user details
    const { data: creator } = await supabaseAdmin
      .from('users')
      .select('user_name, company_name, branch_name')
      .eq('id', paymentLink.creator_id)
      .single();

    await emailService.sendAdminPaymentNotification({
      payment_link_id: paymentLink.id,
      transaction_id: transaction.id,
      service_amount_aed: paymentLink.service_amount_aed || 0,
      decode_amount_aed: paymentLink.decode_amount_aed || 0,
      total_amount_aed: paymentLink.total_amount_aed || 0,
      platform_fee: 0, // Add platform fee calculation if needed
      company_name: creator?.company_name || 'Unknown Company',
      staff_name: creator?.user_name || 'Unknown Staff',
      branch_name: creator?.branch_name,
      client_name: paymentLink.client_name || 'Unknown Client',
      client_email: paymentLink.client_email,
      client_phone: paymentLink.client_phone,
      service_name: paymentLink.title || 'Service Payment',
      service_description: paymentLink.description,
      payment_method: transaction.payment_method_type || 'Unknown',
      payment_processor: transaction.payment_processor || 'stripe',
      processor_transaction_id: transaction.processor_transaction_id,
      completed_at: transaction.completed_at || new Date().toISOString()
    });
    console.log('✅ PAYMENT: Admin payment notification sent');
  } catch (emailError) {
    console.error('⚠️ PAYMENT: Failed to send admin notification:', emailError);
    // Don't fail the payment if email fails
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentLinkId, paymentIntentId } = body;

    if (!paymentLinkId) {
      return NextResponse.json({ error: 'Payment link ID is required' }, { status: 400 });
    }

    // First, check if ANY transaction exists for this payment link
    const { data: existingTransactions, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('payment_link_id', paymentLinkId);

    if (fetchError) {
      console.error('❌ API: Error fetching transactions:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    console.log('🔍 API: Total existing transactions:', existingTransactions?.length || 0);

    // If no transactions exist at all, create one
    if (!existingTransactions || existingTransactions.length === 0) {
      console.log('⚠️ API: No transactions found - creating new completed transaction');
      
      // Get payment link details
      const { data: paymentLink, error: linkError } = await supabaseAdmin
        .from('payment_links')
        .select('*')
        .eq('id', paymentLinkId)
        .single();
        
      if (linkError || !paymentLink) {
        console.error('❌ Cannot create transaction - payment link not found:', linkError);
        return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
      }
      
      // Create a completed transaction
      const newTransaction = {
        payment_link_id: paymentLinkId,
        amount_aed: paymentLink.amount_aed,
        status: 'completed',
        payment_processor: 'stripe',
        processor_transaction_id: paymentIntentId || `manual_${Date.now()}`,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        metadata: {
          created_from: 'success_page_api',
          payment_intent: paymentIntentId,
          client_name: paymentLink.client_name,
          service_title: paymentLink.title
        }
      };
      
      const { data: createdTx, error: createError } = await supabaseAdmin
        .from('transactions')
        .insert(newTransaction)
        .select()
        .single();
        
      if (createError) {
        console.error('❌ Failed to create transaction:', createError);
        return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
      }
      
      console.log('✅ Created new completed transaction:', createdTx.id);

      // Send payment notification email
      await sendPaymentNotification(createdTx, paymentLink);

      // Also directly update payment_links to trigger real-time subscription
      console.log('🔄 API: Updating payment_links for real-time subscription...');
      const { error: linkErrorCreate } = await supabaseAdmin
        .from('payment_links')
        .update({
          payment_status: 'paid',
          is_paid: true,
          paid_at: new Date().toISOString()
        })
        .eq('id', paymentLinkId);
        
      if (linkErrorCreate) {
        console.error('❌ API: Failed to update payment_links for real-time:', linkErrorCreate);
      } else {
        console.log('✅ API: Payment link updated - real-time subscription should trigger');
      }
      
      return NextResponse.json({ 
        success: true, 
        action: 'created', 
        transaction: createdTx 
      });
    }

    // Update pending transactions to completed
    const pendingTransactions = existingTransactions.filter(tx => tx.status === 'pending');
    console.log('🔍 API: Pending transactions to update:', pendingTransactions.length);

    const updatedTransactions = [];
    for (const transaction of pendingTransactions) {
      const updateData: any = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // If we have a payment intent ID and the transaction doesn't have one, add it
      if (paymentIntentId && !transaction.processor_transaction_id) {
        updateData.processor_transaction_id = paymentIntentId;
      }
      
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('transactions')
        .update(updateData)
        .eq('id', transaction.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ API: Failed to update transaction:', transaction.id, updateError);
      } else {
        console.log('✅ API: Successfully updated transaction:', transaction.id);
        updatedTransactions.push(updated);

        // Send payment notification email for this updated transaction
        const { data: paymentLinkForNotification } = await supabaseAdmin
          .from('payment_links')
          .select('*')
          .eq('id', paymentLinkId)
          .single();

        if (paymentLinkForNotification) {
          await sendPaymentNotification(updated, paymentLinkForNotification);
        }
      }
    }
    
    // Also directly update payment_links to trigger real-time subscription
    // This ensures the my-links page updates immediately with heart animation
    if (updatedTransactions.length > 0) {
      console.log('🔄 API: Updating payment_links for real-time subscription...');
      const { error: linkErrorUpdate } = await supabaseAdmin
        .from('payment_links')
        .update({
          payment_status: 'paid',
          is_paid: true,
          paid_at: new Date().toISOString()
        })
        .eq('id', paymentLinkId);
        
      if (linkErrorUpdate) {
        console.error('❌ API: Failed to update payment_links for real-time:', linkErrorUpdate);
      } else {
        console.log('✅ API: Payment link updated - real-time subscription should trigger');
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      action: 'updated', 
      updatedCount: updatedTransactions.length,
      transactions: updatedTransactions 
    });
    
  } catch (error) {
    console.error('❌ API: Error in update-transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}