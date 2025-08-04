import { NextRequest, NextResponse } from 'next/server'
import { stripeService } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe signature' }, { status: 400 })
  }

  let event

  try {
    event = stripeService.verifyWebhookSignature(body, signature)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Handle Connect account events
  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as any
        console.log('Account updated:', account.id)

        // Update user's account status in database
        const { error } = await supabaseAdmin
          .from('users')
          .update({
            stripe_connect_status: account.charges_enabled && account.payouts_enabled ? 'active' : 'pending',
            stripe_onboarding_completed: account.details_submitted,
            stripe_payouts_enabled: account.payouts_enabled,
            stripe_charges_enabled: account.charges_enabled,
            stripe_details_submitted: account.details_submitted,
            stripe_capabilities: account.capabilities,
            stripe_requirements: account.requirements
          })
          .eq('stripe_connect_account_id', account.id)

        if (error) {
          console.error('Failed to update account status:', error)
        }

        // Check if onboarding is complete
        if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
          console.log('Account onboarding completed:', account.id)
          
          // Create initial bank account record if it doesn't exist
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('stripe_connect_account_id', account.id)
            .single()

          if (user) {
            // Check if bank account already exists
            const { data: existingAccount } = await supabaseAdmin
              .from('user_bank_accounts')
              .select('id')
              .eq('user_id', user.id)
              .eq('stripe_account_id', account.id)
              .single()

            if (!existingAccount && account.external_accounts?.data?.[0]) {
              const bankAccount = account.external_accounts.data[0]
              
              // Create bank account record
              await supabaseAdmin
                .from('user_bank_accounts')
                .insert({
                  user_id: user.id,
                  bank_name: bankAccount.bank_name || 'Bank',
                  beneficiary_name: bankAccount.account_holder_name || account.business_profile?.name || '',
                  iban_number: `****${bankAccount.last4}`,
                  routing_number: bankAccount.routing_number || '',
                  is_verified: true,
                  is_primary: true,
                  status: 'verified',
                  verification_method: 'stripe_connect',
                  verified_at: new Date().toISOString(),
                  stripe_account_id: account.id,
                  external_account_id: bankAccount.id
                })
            }
          }
        }
        break
      }

      case 'account.application.authorized':
        console.log('Account application authorized:', event.data.object)
        break

      case 'account.application.deauthorized':
        console.log('Account application deauthorized:', event.data.object)
        // Handle account disconnection
        const accountId = (event.data.object as any).account
        await supabaseAdmin
          .from('users')
          .update({
            stripe_connect_status: 'disconnected',
            stripe_onboarding_completed: false
          })
          .eq('stripe_connect_account_id', accountId)
        break

      case 'payout.created':
      case 'payout.paid':
      case 'payout.failed':
        // Handle payout events
        const payout = event.data.object as any
        console.log(`Payout ${event.type}:`, payout.id)
        
        // Update payout record in database
        const payoutStatus = event.type === 'payout.paid' ? 'paid' : 
                           event.type === 'payout.failed' ? 'failed' : 'pending'
        
        await supabaseAdmin
          .from('payouts')
          .update({
            status: payoutStatus,
            paid_at: event.type === 'payout.paid' ? new Date().toISOString() : null,
            failure_reason: payout.failure_message || null
          })
          .eq('stripe_payout_id', payout.id)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}