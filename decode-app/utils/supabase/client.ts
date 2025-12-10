import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Use fallback values if environment variables are not available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vdgjzaaxvstbouklgsft.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZ2p6YWF4dnN0Ym91a2xnc2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA2NzE3MzQsImV4cCI6MjA2NjI0NzczNH0.98TuBpnqy3rHMRQtVJxuC466ymjCBAikik7KgGX5QDM'

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables')
    throw new Error('supabaseKey is required.')
  }

  // Browser client handles cookies automatically
  // Custom cookie options are not supported in the browser client
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )
}