import { stripeService } from './stripe'
import { supabaseAdmin } from './supabase-admin'
import { logger } from './logger'

interface CreateTransferRequest {
  paymentIntentId: string
  connectedAccountId: string
  amountAed: number
  paymentId: string
  userId: string
}

export class StripeTransferService {
  /**
   * Create a transfer to a connected account after payment success
   * This transfers the full service amount to the beauty professional
   * The platform fee has already been collected as part of the total charge
   */
  async createTransfer(request: CreateTransferRequest) {
    try {
      // Ensure Stripe is initialized
      stripeService.ensureStripeInitialized()

      // Convert AED to cents (fils)
      const amountInFils = Math.round(request.amountAed * 100)

      // Create the transfer to the connected account
      const transfer = await stripeService.stripe.transfers.create({
        amount: amountInFils,
        currency: 'aed',
        destination: request.connectedAccountId,
        transfer_group: request.paymentIntentId,
        description: `Payment for beauty service - ${request.paymentIntentId}`,
        metadata: {
          payment_id: request.paymentId,
          user_id: request.userId,
          payment_intent_id: request.paymentIntentId
        }
      })

      // Record the transfer in the database
      const { error: dbError } = await supabaseAdmin
        .from('transfers')
        .insert({
          payment_id: request.paymentId,
          user_id: request.userId,
          amount_aed: request.amountAed,
          stripe_transfer_id: transfer.id,
          stripe_connect_account_id: request.connectedAccountId,
          status: 'completed',
          completed_at: new Date().toISOString()
        })

      if (dbError) {
        logger.error('Failed to record transfer in database:', dbError)
        // Don't fail the transfer, it was successful in Stripe
      }

      logger.info(`Transfer created: ${transfer.id} for AED ${request.amountAed} to ${request.connectedAccountId}`)
      
      return {
        success: true,
        transferId: transfer.id,
        amount: request.amountAed
      }

    } catch (error) {
      logger.error('Transfer creation failed:', error)
      
      // Record failed transfer attempt
      await supabaseAdmin
        .from('transfers')
        .insert({
          payment_id: request.paymentId,
          user_id: request.userId,
          amount_aed: request.amountAed,
          stripe_connect_account_id: request.connectedAccountId,
          status: 'failed',
          failure_reason: error instanceof Error ? error.message : 'Unknown error'
        })

      throw error
    }
  }

  /**
   * Get pending balance for a connected account
   */
  async getAccountBalance(connectedAccountId: string) {
    try {
      stripeService.ensureStripeInitialized()

      const balance = await stripeService.stripe.balance.retrieve({
        stripeAccount: connectedAccountId
      })

      // Find AED balance
      const aedBalance = balance.available.find(b => b.currency === 'aed')
      const aedPending = balance.pending.find(b => b.currency === 'aed')

      return {
        available: aedBalance ? aedBalance.amount / 100 : 0,
        pending: aedPending ? aedPending.amount / 100 : 0,
        currency: 'AED'
      }
    } catch (error) {
      logger.error('Failed to get account balance:', error)
      return {
        available: 0,
        pending: 0,
        currency: 'AED'
      }
    }
  }

  /**
   * Create a manual payout for weekly payouts
   * Called by a scheduled job every Monday
   */
  async createWeeklyPayout(connectedAccountId: string, userId: string) {
    try {
      stripeService.ensureStripeInitialized()

      // Get available balance
      const balance = await this.getAccountBalance(connectedAccountId)
      
      if (balance.available <= 0) {
        logger.info(`No balance available for payout to ${connectedAccountId}`)
        return null
      }

      // Create payout for the available balance
      const payout = await stripeService.stripe.payouts.create(
        {
          amount: Math.round(balance.available * 100), // Convert to fils
          currency: 'aed',
          description: 'Weekly payout from DECODE Beauty',
          metadata: {
            user_id: userId,
            payout_type: 'weekly_scheduled'
          }
        },
        {
          stripeAccount: connectedAccountId
        }
      )

      // Calculate the date range for this payout (last 7 days)
      const endDate = new Date()
      endDate.setHours(0, 0, 0, 0)
      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - 7)

      // Record payout in database
      await supabaseAdmin
        .from('payouts')
        .insert({
          user_id: userId,
          amount_aed: balance.available,
          stripe_payout_id: payout.id,
          stripe_connect_account_id: connectedAccountId,
          status: 'pending',
          period_start: startDate.toISOString().split('T')[0],
          period_end: endDate.toISOString().split('T')[0],
          scheduled_for: endDate.toISOString().split('T')[0]
        })

      logger.info(`Weekly payout created: ${payout.id} for AED ${balance.available}`)
      
      return {
        payoutId: payout.id,
        amount: balance.available,
        status: payout.status
      }

    } catch (error) {
      logger.error('Weekly payout creation failed:', error)
      throw error
    }
  }
}

export const stripeTransferService = new StripeTransferService()