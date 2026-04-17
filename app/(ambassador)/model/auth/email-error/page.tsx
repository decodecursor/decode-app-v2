export default function EmailErrorPage() {
  return (
    <div style={{
      padding: '0 24px',
      paddingTop: '160px',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
        Link doesn&apos;t work
      </h1>
      <p style={{
        fontSize: '13px',
        color: '#888',
        lineHeight: 1.65,
        marginBottom: '40px',
        maxWidth: '280px',
        margin: '0 auto 40px',
      }}>
        This email link is no longer valid.<br />
        Request a new one after signing in.
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
