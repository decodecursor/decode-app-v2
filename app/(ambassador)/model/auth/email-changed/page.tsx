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
      <style>{`
        .email-change-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 40px;
        }
        .email-change-card {
          flex: 1;
          min-width: 0;
          background: #1c1c1c;
          border-radius: 12px;
          padding: 12px 16px;
          text-align: left;
        }
        .email-change-card-old { border: 1px solid #262626; }
        .email-change-card-new { border: 1px solid #e91e8c; }
        .email-change-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .email-change-label-old { color: #666; }
        .email-change-label-new { color: #e91e8c; }
        .email-change-value {
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .email-change-value-old { color: #888; }
        .email-change-value-new { color: #fff; font-weight: 600; }
        .email-change-arrow-h {
          color: #e91e8c;
          font-size: 16px;
          flex-shrink: 0;
        }
        .email-change-arrow-v { display: none; }

        @media (max-width: 450px) {
          .email-change-row {
            flex-direction: column;
            align-items: stretch;
            gap: 0;
          }
          .email-change-card {
            flex: 0 1 auto;
            border-radius: 10px;
            padding: 10px 12px;
          }
          .email-change-card-old {
            background: #111;
            border: 1px solid #2a2a2a;
          }
          .email-change-card-new {
            background: rgba(233,30,140,0.06);
          }
          .email-change-label {
            letter-spacing: 1.2px;
            font-weight: 500;
          }
          .email-change-label-old { color: #888; }
          .email-change-value-old { color: #fff; }
          .email-change-arrow-h { display: none; }
          .email-change-arrow-v {
            display: block;
            color: #e91e8c;
            font-size: 14px;
            text-align: center;
            margin: 8px 0;
          }
        }
      `}</style>

      <ProgressTracker
        steps={['Sent', 'Opened', 'Done']}
        step={4}
        marginBottom={32}
      />

      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '32px' }}>
        Email changed!
      </h1>

      <div className="email-change-row">
        <div className="email-change-card email-change-card-old">
          <div className="email-change-label email-change-label-old">Old</div>
          <div className="email-change-value email-change-value-old">{oldEmail}</div>
        </div>

        <span className="email-change-arrow-h" aria-hidden="true">&rarr;</span>
        <span className="email-change-arrow-v" aria-hidden="true">&darr;</span>

        <div className="email-change-card email-change-card-new">
          <div className="email-change-label email-change-label-new">New</div>
          <div className="email-change-value email-change-value-new">{newEmail}</div>
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
