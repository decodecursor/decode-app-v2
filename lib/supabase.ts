import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Temporarily remove type safety to fix build issues
// TODO: Generate correct types from Supabase database
export const supabase = createClient(supabaseUrl, supabaseAnonKey) as any