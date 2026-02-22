import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client authenticated with the service role key.
 * This client bypasses Row Level Security and can perform auth.admin operations.
 *
 * SERVER ONLY -- never import this from a Client Component.
 * The service role key is not exposed to the browser (no NEXT_PUBLIC_ prefix).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'Missing environment variable: NEXT_PUBLIC_SUPABASE_URL'
    )
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing environment variable: SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
