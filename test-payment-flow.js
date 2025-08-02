const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://vdgjzaaxvstbouklgsft.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZ2p6YWF4dnN0Ym91a2xnc2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NzE3MzQsImV4cCI6MjA2NjI0NzczNH0.98TuBpnqy3rHMRQtVJxuC466ymjCBAikik7KgGX5QDM';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPaymentFlow() {
  console.log('🧪 Testing Payment Flow');
  console.log('====================\n');

  // Test payment link ID (replace with actual)
  const paymentLinkId = 'a648752c-7013-4c7c-8280-0398d88f8d45';
  
  try {
    // 1. Check if payment link exists
    console.log('1️⃣ Checking payment link...');
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', paymentLinkId)
      .single();
      
    if (linkError || !paymentLink) {
      console.error('❌ Payment link not found:', linkError);
      return;
    }
    
    console.log('✅ Payment link found:');
    console.log(`   - Title: ${paymentLink.title}`);
    console.log(`   - Amount: AED ${paymentLink.amount_aed}`);
    console.log(`   - Active: ${paymentLink.is_active}`);
    console.log('');
    
    // 2. Check all transactions for this payment link
    console.log('2️⃣ Checking transactions...');
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('payment_link_id', paymentLinkId)
      .order('created_at', { ascending: false });
      
    if (txError) {
      console.error('❌ Error fetching transactions:', txError);
      return;
    }
    
    console.log(`📊 Found ${transactions?.length || 0} transaction(s)`);
    
    if (transactions && transactions.length > 0) {
      transactions.forEach((tx, index) => {
        console.log(`\n📋 Transaction ${index + 1}:`);
        console.log(`   - ID: ${tx.id}`);
        console.log(`   - Status: ${tx.status}`);
        console.log(`   - Amount: AED ${tx.amount_aed}`);
        console.log(`   - Processor: ${tx.payment_processor}`);
        console.log(`   - Payment Intent: ${tx.processor_transaction_id || 'none'}`);
        console.log(`   - Created: ${new Date(tx.created_at).toLocaleString()}`);
        console.log(`   - Completed: ${tx.completed_at ? new Date(tx.completed_at).toLocaleString() : 'not completed'}`);
        
        if (tx.metadata) {
          console.log(`   - Metadata: ${JSON.stringify(tx.metadata, null, 2)}`);
        }
      });
      
      // Check if any transaction is completed
      const completedTx = transactions.find(tx => tx.status === 'completed');
      if (completedTx) {
        console.log('\n✅ PAYMENT IS COMPLETED');
        console.log('   The payment link should show as "already paid"');
      } else {
        console.log('\n⚠️ NO COMPLETED TRANSACTIONS');
        console.log('   The payment link will show the payment form');
      }
    } else {
      console.log('❌ No transactions found for this payment link');
      console.log('   This means no payment has been initiated yet');
    }
    
    // 3. Check webhook events (if table exists)
    console.log('\n3️⃣ Checking webhook events...');
    const { data: webhooks, error: webhookError } = await supabase
      .from('webhook_events')
      .select('event_id, event_type, status, created_at')
      .eq('payment_link_id', paymentLinkId)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (webhookError) {
      console.log('⚠️ Cannot check webhook events (table may not exist)');
    } else {
      console.log(`📬 Found ${webhooks?.length || 0} webhook event(s)`);
      if (webhooks && webhooks.length > 0) {
        webhooks.forEach(wh => {
          console.log(`   - ${wh.event_type}: ${wh.status} (${new Date(wh.created_at).toLocaleString()})`);
        });
      }
    }
    
    // 4. Summary
    console.log('\n📊 SUMMARY');
    console.log('==========');
    console.log(`Payment Link: ${paymentLinkId}`);
    console.log(`Total Transactions: ${transactions?.length || 0}`);
    console.log(`Completed Transactions: ${transactions?.filter(tx => tx.status === 'completed').length || 0}`);
    console.log(`Should Show as Paid: ${transactions?.some(tx => tx.status === 'completed') ? 'YES ✅' : 'NO ❌'}`);
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the test
testPaymentFlow();