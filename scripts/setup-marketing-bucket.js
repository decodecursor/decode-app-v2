/**
 * Setup Marketing Bucket
 *
 * Idempotently creates the public `marketing` bucket used by the Ambassador
 * landing for video + poster assets. Safe to re-run.
 *
 * Usage:
 *   node scripts/setup-marketing-bucket.js
 *
 * Prerequisites:
 *   .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const { createClient } = require('@supabase/supabase-js')

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: buckets, error: listErr } = await supabase.storage.listBuckets()
  if (listErr) throw listErr

  const existing = buckets?.find((b) => b.name === 'marketing')
  if (existing) {
    if (!existing.public) {
      const { error } = await supabase.storage.updateBucket('marketing', { public: true })
      if (error) throw error
      console.log('marketing bucket existed (private) — flipped to public')
    } else {
      console.log('marketing bucket already exists and is public')
    }
    return
  }

  const { error } = await supabase.storage.createBucket('marketing', { public: true })
  if (error) throw error
  console.log('Created public marketing bucket')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
