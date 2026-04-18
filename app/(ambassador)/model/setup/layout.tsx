import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/model/auth')
  }

  const adminClient = createServiceRoleClient()
  const { data: existingProfile } = await adminClient
    .from('model_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingProfile) {
    redirect('/model')
  }

  return <>{children}</>
}
