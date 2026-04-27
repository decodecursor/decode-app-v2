import { createServiceRoleClient } from '@/utils/supabase/service-role'
import {
  sendListingExpiringEmail,
  sendListingExpiringWhatsApp,
} from './notification-stubs'

interface ExpiringListingRow {
  id: string
  paid_until: string
  category_custom: string | null
  category: { name: string } | null
  professional: { name: string } | null
  model: {
    first_name: string | null
    user: {
      email: string | null
      phone_number: string | null
    } | null
  } | null
}

/**
 * Daily-cron helper · 7-day listing-expiry notifications (ambassador).
 *
 * Selects active paid listings whose paid_until lands within the
 * next 7 days and which have not yet been notified, then fires
 * email + WhatsApp per listing. Stamps expiry_notification_sent_at
 * unconditionally after the send-attempt — partner-acceptable
 * failure mode is one dropped notification, NOT duplicate sends
 * if Resend / AUTHKey are flaky.
 *
 * Free-trial listings are excluded — they have a separate
 * conversion path via the send-link button (Slice 4D).
 *
 * Returns { sent, errors }: `sent` is the count of listings
 * processed (independent of channel-level success — stamping
 * counts as processed); `errors` counts per-row exceptions in
 * the helper itself (DB read/update failures, unexpected throws).
 * Channel send errors are swallowed by the senders and logged
 * there.
 */
export async function sendListingExpiringNotifications(): Promise<{ sent: number; errors: number }> {
  const admin = createServiceRoleClient()
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const { data: rows, error: readErr } = await admin
    .from('model_listings_live')
    .select(`
      id,
      paid_until,
      category_custom,
      category:model_categories(name),
      professional:model_professionals(name),
      model:model_profiles(
        first_name,
        user:users(email, phone_number)
      )
    `)
    .gte('paid_until', now.toISOString())
    .lte('paid_until', sevenDaysFromNow.toISOString())
    .is('expiry_notification_sent_at', null)
    .eq('status', 'active')
    .eq('is_free_trial', false)
    .returns<ExpiringListingRow[]>()

  if (readErr) {
    console.error('[cron-helpers:listing_expiring] select failed', readErr)
    return { sent: 0, errors: 1 }
  }

  if (!rows || rows.length === 0) {
    return { sent: 0, errors: 0 }
  }

  let errors = 0
  let sent = 0

  for (const row of rows) {
    try {
      const ambassadorEmail = row.model?.user?.email ?? null
      const ambassadorPhone = row.model?.user?.phone_number ?? null
      const firstName = row.model?.first_name ?? 'there'
      const professionalName = row.professional?.name ?? 'your professional'
      const serviceName = row.category_custom ?? row.category?.name ?? 'your service'
      const paidUntil = new Date(row.paid_until)

      // Latest completed payment_reference for the listing (the
      // L-XXX-XXXX shown in the email + WhatsApp body).
      const { data: payment } = await admin
        .from('model_listing_payments')
        .select('payment_reference')
        .eq('listing_id', row.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const listingReference = payment?.payment_reference ?? ''

      // Fire each channel under its own try/catch — one failure
      // does not poison the other. Senders themselves swallow
      // their channel errors, so this is belt-and-suspenders.
      if (ambassadorEmail) {
        try {
          await sendListingExpiringEmail({
            ambassadorEmail,
            ambassadorName: firstName,
            serviceName,
            professionalName,
            paidUntil,
            listingId: row.id,
            listingReference,
          })
        } catch (err) {
          console.error('[cron-helpers:listing_expiring] email threw', { listingId: row.id, err })
        }
      }

      try {
        await sendListingExpiringWhatsApp({
          ambassadorPhone,
          firstName,
          serviceName,
          professionalName,
          paidUntil,
          listingReference,
        })
      } catch (err) {
        console.error('[cron-helpers:listing_expiring] whatsapp threw', { listingId: row.id, err })
      }

      // Stamp regardless of channel-level success (fail-soft per
      // spec — one dropped notification preferable to duplicate
      // spam on retry).
      const { error: updateErr } = await admin
        .from('model_listings')
        .update({ expiry_notification_sent_at: new Date().toISOString() })
        .eq('id', row.id)
      if (updateErr) {
        console.error('[cron-helpers:listing_expiring] stamp failed', { listingId: row.id, error: updateErr })
        errors++
      } else {
        sent++
      }
    } catch (err) {
      console.error('[cron-helpers:listing_expiring] per-row threw', { listingId: row.id, err })
      errors++
    }
  }

  return { sent, errors }
}
