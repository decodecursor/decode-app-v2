/**
 * "Powered by WeLoveDecode" footer. Same-tab link per spec §2.2.
 */
export function PublicFooter() {
  return (
    <div style={{ padding: '8px 20px 20px', textAlign: 'center' }}>
      <a
        href="https://app.welovedecode.com/"
        style={{ fontSize: 12, color: '#777', textDecoration: 'none' }}
      >
        Powered by WeLoveDecode
      </a>
    </div>
  )
}
