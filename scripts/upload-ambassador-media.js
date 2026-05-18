/**
 * Upload Ambassador Media
 *
 * Uploads the two video files and three poster JPEGs used by the Ambassador
 * landing into the public `marketing` bucket at `ambassador/videos/`.
 *
 * Usage:
 *   node scripts/upload-ambassador-media.js
 *
 * Prerequisites:
 *   - Run `node scripts/setup-marketing-bucket.js` first.
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *   - The three poster JPEGs in <repo>/_features/ambassador/posters/:
 *       endorsement.jpg, whisper.jpg, loudest-wins.jpg
 *   - The two video files already at public/ambassador/videos/.
 */

const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const { createClient } = require('@supabase/supabase-js')

const ROOT = path.join(__dirname, '..')
const POSTER_DIR = path.join(ROOT, '_features/ambassador/posters')
const VIDEO_DIR = path.join(ROOT, 'public/ambassador/videos')

const uploads = [
  [path.join(VIDEO_DIR, 'endorsement.mp4'),  'ambassador/videos/endorsement.mp4',  'video/mp4'],
  [path.join(VIDEO_DIR, 'whisper.mp4'),      'ambassador/videos/whisper.mp4',      'video/mp4'],
  [path.join(POSTER_DIR, 'endorsement.jpg'),  'ambassador/videos/endorsement.jpg',  'image/jpeg'],
  [path.join(POSTER_DIR, 'whisper.jpg'),      'ambassador/videos/whisper.jpg',      'image/jpeg'],
  [path.join(POSTER_DIR, 'loudest-wins.jpg'), 'ambassador/videos/loudest-wins.jpg', 'image/jpeg'],
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const missing = uploads.filter(([local]) => !fs.existsSync(local)).map(([local]) => local)
  if (missing.length) {
    console.error('Missing source files:')
    for (const m of missing) console.error('  -', m)
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let failed = 0
  for (const [localPath, bucketPath, contentType] of uploads) {
    const buf = fs.readFileSync(localPath)
    const { error } = await supabase.storage
      .from('marketing')
      .upload(bucketPath, buf, { contentType, upsert: true })
    if (error) {
      console.error(`FAILED ${bucketPath}: ${error.message}`)
      failed++
    } else {
      const { data } = supabase.storage.from('marketing').getPublicUrl(bucketPath)
      console.log(`Uploaded ${bucketPath}`)
      console.log(`  -> ${data.publicUrl}`)
    }
  }

  if (failed) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
