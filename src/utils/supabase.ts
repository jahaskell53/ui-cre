import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (cachedClient) return cachedClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("@supabase/ssr: Your project's URL and API key are required to create a Supabase client!")
  }

  cachedClient = createBrowserClient(supabaseUrl, supabaseKey)
  return cachedClient
}

// Backward-compatible export that avoids initializing at module load
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (createClient() as any)[prop]
  },
}) as SupabaseClient
