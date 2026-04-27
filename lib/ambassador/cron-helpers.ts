import { createServiceRoleClient } from '@/utils/supabase/service-role'
import {
  sendListingExpiringEmail,
  sendListingExpiringProEmail,
  sendListingExpiringWhatsApp,
} from './notification-stubs'

interface ExpiringListingRow {
  id: string
  paid_until: string | null
  free_trial_ends_at: string | null
  is_free_trial: boolean
  category_custom: string | null
  category: { name: string } | null
  professional: { name: string } | null
  model: {
    first_name: string | null
    last_name: string | null
    user: {
      email: string | null
      phone_number: string | null
    } | null
  } | null
}

/**
 * Daily-cron helper · 7-day listing-expiry notifications (ambassador).
 *
 * Two cohorts in one pass:
 * - PAID  (status='active', is_free_trial=false): paid_until in
 *   next 7 days → "Time to renew" email + WhatsApp, CTA = send
 *   renewal link.
 * - TRIAL (status='free_trial', is_free_trial=true):
 *   free_trial_ends_at in next 7 days → "Time to upgrade" email
 *   variant, CTA = send payment link. Trials reuse the same
 *   WhatsApp template (partner-locked) — body slot {{5}} is
 *   blank since no payment_reference exists yet.
 *
 * Stamps expiry_notification_sent_at unconditionally after the
 * send-attempt — partner-acceptable failure mode is one dropped
 * notification, NOT duplicate sends if Resend / AUTHKey are flaky.
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
  const nowISO = now.toISOString()
  const sevenDaysISO = sevenDaysFromNow.toISOString()

  // OR over two cohorts: paid listings (use paid_until) and free
  // trials (use free_trial_ends_at). PostgREST .or() with nested
  // .and() groups; ISO timestamps don't contain commas so the
  // filter string is unambiguous.
  const cohortFilter = [
    `and(is_free_trial.eq.false,status.eq.active,paid_until.gte.${nowISO},paid_until.lte.${sevenDaysISO})`,
    `and(is_free_trial.eq.true,status.eq.free_trial,free_trial_ends_at.gte.${nowISO},free_trial_ends_at.lte.${sevenDaysISO})`,
  ].join(',')

  const { data: rows, error: readErr } = await admin
    .from('model_listings_live')
    .select(`
      id,
      paid_until,
      free_trial_ends_at,
      is_free_trial,
      category_custom,
      category:model_categories(name),
      professional:model_professionals(name),
      model:model_profiles(
        first_name,
        last_name,
        user:users(email, phone_number)
      )
    `)
    .is('expiry_notification_sent_at', null)
    .or(cohortFilter)
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
      const isFreeTrial = row.is_free_trial
      const expiryRaw = isFreeTrial ? row.free_trial_ends_at : row.paid_until
      if (!expiryRaw) {
        // Belt-and-suspenders: filter guarantees a non-null
        // expiry, but if the cohort source column is somehow
        // null we skip rather than email "Invalid Date".
        console.error('[cron-helpers:listing_expiring] missing expiry, skipping', { listingId: row.id, isFreeTrial })
        errors++
        continue
      }
      const expiryAt = new Date(expiryRaw)

      // Latest completed payment row (only for PAID — trials have no
      // payment yet; reference stays empty + the pro email is skipped).
      // We pull payer_email + package_days alongside the reference so
      // the pro-facing email can fire without a second round-trip.
      let listingReference = ''
      let payerEmail: string | null = null
      let packageDays: number | null = null
      if (!isFreeTrial) {
        const { data: payment } = await admin
          .from('model_listing_payments')
          .select('payment_reference, payer_email, package_days')
          .eq('listing_id', row.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle<{
            payment_reference: string
            payer_email: string | null
            package_days: number
          }>()
        listingReference = payment?.payment_reference ?? ''
        payerEmail = payment?.payer_email ?? null
        packageDays = payment?.package_days ?? null
      }

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
            expiryAt,
            listingId: row.id,
            listingReference,
            isFreeTrial,
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
          expiryAt,
          listingReference,
        })
      } catch (err) {
        console.error('[cron-helpers:listing_expiring] whatsapp threw', { listingId: row.id, err })
      }

      // Pro-facing email — paid listings only with a captured
      // payer_email. Trials excluded by design (no professional
      // payer); rows with null payer_email skipped silently.
      if (!isFreeTrial && payerEmail) {
        const ambassadorFullName = `${row.model?.first_name ?? ''} ${row.model?.last_name ?? ''}`.trim()
        const expiryDateFormatted = new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(expiryAt)
        try {
          await sendListingExpiringProEmail({
            payerEmail,
            serviceName,
            ambassadorFullName,
            ambassadorFirstName: firstName,
            packageDays: packageDays != null ? `${packageDays} days` : '',
            expiryDate: expiryDateFormatted,
            listingReference,
          })
        } catch (err) {
          console.error('[cron-helpers:listing_expiring] pro email threw', { listingId: row.id, err })
        }
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
