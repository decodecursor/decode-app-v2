import { randomBytes } from 'crypto'

export const COVER_BUCKET = 'model-media'

export function buildCoverObjectPath(userId: string, ext: string): string {
  return `${userId}/${Date.now()}-${randomBytes(3).toString('hex')}.${ext}`
}

export function extractCoverObjectPath(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null
  const marker = `/storage/v1/object/public/${COVER_BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  const path = publicUrl.slice(idx + marker.length).split('?')[0]
  return path || null
}
