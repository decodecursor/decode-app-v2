#!/usr/bin/env node

/**
 * One-off: replace the all-black video thumbnail on Alesia Divin's listing
 * (slug `alesiadivin`) with a real frame extracted from her .mov.
 *
 * The frame was already grabbed to scripts/_alesia-thumb.jpg. This uploads
 * it to the model-media bucket and points the listing row at it.
 *
 * Run: node scripts/fix-alesia-thumbnail.mjs
 * Needs .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Simple .env.local parser (matches scripts/fix-payment-link.mjs).
function loadEnv() {
  try {
    const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
    for (const line of envFile.split('\n')) {
      if (line.trim() && !line.startsWith('#') && line.includes('=')) {
        const [key, ...rest] = line.split('=')
        process.env[key.trim()] = rest.join('=').trim()
      }
    }
  } catch (e) {
    console.error('Could not load .env.local:', e.message)
  }
}
loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const BUCKET = 'model-media'
const PATH = '6c85eaac-efb6-4b3d-8fa9-d59d6b39511f/listings/thumbs/alesiadivin-fixed.jpg'
const LISTING_ID = '9e95c2aa-6d89-445d-a47e-c57cd0d3b5a5'

const bytes = fs.readFileSync(path.join(__dirname, '_alesia-thumb.jpg'))

const up = await sb.storage.from(BUCKET).upload(PATH, bytes, {
  contentType: 'image/jpeg',
  upsert: true,
})
if (up.error) { console.error('❌ upload:', up.error.message); process.exit(1) }

const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(PATH)
const publicUrl = pub.publicUrl

const upd = await sb
  .from('model_listings_live')
  .update({ video_thumbnail_url: publicUrl })
  .eq('id', LISTING_ID)
if (upd.error) { console.error('❌ update:', upd.error.message); process.exit(1) }

console.log('✅ Thumbnail fixed ->', publicUrl)
