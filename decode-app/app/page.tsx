import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function Home() {
  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If authenticated, go to dashboard, otherwise to auth
  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/auth')
  }
}
