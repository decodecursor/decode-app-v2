import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { ProgressTracker } from '@/components/ambassador/ProgressTracker'

const DISPLAY_WINDOW_MINUTES = 15

export default async function EmailChangedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams

  if (!ref || !/^[a-f0-9]{64}$/i.test(ref)) {
    redirect('/model/settings')
  }

  const admin = createServiceRoleClient()
  const freshnessCutoff = new Date(Date.now() - DISPLAY_WINDOW_MINUTES * 60 * 1000).toISOString()

  const { data: row } = await admin
    .from('email_change_requests')
    .select('old_email, new_email, flow')
    .eq('token', ref)
    .gt('consumed_at', freshnessCutoff)
    .maybeSingle()

  if (!row || row.flow !== 'change' || !row.old_email) {
    redirect('/model/settings')
  }

  const oldEmail: string = row.old_email
  const newEmail: string = row.new_email

  return (
    <div style={{
      padding: '0 24px',
      paddingTop: '80px',
      paddingBottom: '40px',
      textAlign: 'center',
    }}>
      <ProgressTracker
        steps={['Sent', 'Opened', 'Done']}
        step={4}
        marginBottom={32}
      />

      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '32px' }}>
        Email changed!
      </h1>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '40px',
      }}>
        <div style={{
          background: '#1c1c1c',
          border: '1px solid #262626',
          borderRadius: '12px',
          padding: '12px 16px',
          textAlign: 'left',
        }}>
          <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Old</div>
          <div style={{ fontSize: '13px', color: '#888' }}>{oldEmail}</div>
        </div>

        <span style={{ color: '#e91e8c', fontSize: '16px' }}>&rarr;</span>

        <div style={{
          background: '#1c1c1c',
          border: '1px solid #e91e8c',
          borderRadius: '12px',
          padding: '12px 16px',
          textAlign: 'left',
        }}>
          <div style={{ fontSize: '9px', color: '#e91e8c', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>New</div>
          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>{newEmail}</div>
        </div>
      </div>

      <a
        href="/model/settings"
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
        Go to Settings
      </a>
    </div>
  )
}
