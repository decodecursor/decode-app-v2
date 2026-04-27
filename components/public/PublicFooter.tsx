import { getBrandUrl } from '@/lib/brand-url'

/**
 * "Powered by WeLoveDecode" footer. Links to the marketing apex domain
 * via the BRAND_URL helper so apex migration env-flips this destination
 * alongside the other terminal-page CTAs (Slice 7A Q5). Same tab per
 * spec §2.2.
 */
export function PublicFooter() {
  return (
    <div style={{ padding: '8px 20px 20px', textAlign: 'center' }}>
      <a
        href={getBrandUrl()}
        style={{ fontSize: 12, color: '#777', textDecoration: 'none' }}
      >
        Powered by WeLoveDecode
      </a>
    </div>
  )
}
