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
      <a
        href="/model/auth"
        style={{
          display: 'inline-block',
          background: '#e91e8c',
          color: '#fff',
          textDecoration: 'none',
          padding: '14px 32px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        Go to login
      </a>
    </div>
  )
}
