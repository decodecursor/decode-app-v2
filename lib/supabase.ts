// DEPRECATED: This file is being replaced with standard @supabase/ssr pattern
// Use utils/supabase/client.ts for client-side and utils/supabase/server.ts for server-side
// This export is kept temporarily for backwards compatibility

import { createClient } from '@/utils/supabase/client'

/**
 * @deprecated Use createClient from @/utils/supabase/client instead
 * This export will be removed in future versions
 */
export const supabase = createClient()