import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// WARNING: supabaseAdmin uses the service role key. Never import this in client-side code.
// Only import in src/app/api/** route handlers.
export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin must not be used on the client side.')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}