import type { Metadata } from 'next'
import EmailErrorCTA from './EmailErrorCTA'

/**
 * /model/auth/email-error — universal failure landing for any email
 * auth link rejected by Supabase (magic-link login + email change).
 *
 * Slice 7A locked Q4 (4c): the mockup spec
 * (`email_error_final_UI_Spec.md` §3) prescribes a single universal
 * copy across all four failure cases for security-by-obscurity. The
 * shipped 5-reason copy is materially better UX ("Email already in
 * use" beats "Link doesn't work" for the conflict case) and the
 * security argument doesn't fit a 15-min single-use email link.
 *
 * Decision: keep shipped 5-reason copy (Principle E — match existing
 * patterns); supersede only the universal-copy rule. Cherry-pick the
 * useful mockup mechanics — history.replaceState + button loading-
 * state — into the EmailErrorCTA client subtree.
 *
 * Spec gets a partial supersession block in the 7A closeout doc.
 *
 * `<meta robots noindex>` added per spec §9 — keeps failure URLs out
 * of search engine indexes.
 */

type Reason = 'invalid' | 'expired' | 'used' | 'conflict' | 'server'

const COPY: Record<Reason, { title: string; body: string }> = {
  invalid: {
    title: "Link doesn't work",
    body: 'This email link is no longer valid.\nRequest a new one after signing in.',
  },
  expired: {
    title: 'Link expired',
    body: 'This link expired.\nRequest a new one from Settings.',
  },
  used: {
    title: 'Link already used',
    body: 'This link has already been used.\nIf you need to change your email again, request a new one from Settings.',
  },
  conflict: {
    title: 'Email already in use',
    body: 'That email is already attached to another account.\nTry a different one from Settings.',
  },
  server: {
    title: 'Something went wrong',
    body: "We couldn't confirm the email right now.\nPlease try again in a moment.",
  },
}

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function EmailErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const key: Reason = reason && reason in COPY ? (reason as Reason) : 'invalid'
  const { title, body } = COPY[key]

  return (
    <div style={{
      padding: '0 24px',
      paddingTop: '160px',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
        {title}
      </h1>
      <p style={{
        fontSize: '13px',
        color: '#888',
        lineHeight: 1.65,
        marginBottom: '40px',
        maxWidth: '320px',
        margin: '0 auto 40px',
        whiteSpace: 'pre-line',
      }}>
        {body}
      </p>
      <EmailErrorCTA />
    </div>
  )
}
