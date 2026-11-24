import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

/** A Supabase client that acts AS THE SIGNED-IN VISITOR (their session cookie, the public key), so Row Level Security decides
 * what it may read and write. Never the service key. null when sign-in is off. One per request. */
export async function authClient() {
  if (!AUTH_ENABLED) return null
  const store = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options)
        } catch {
          // A server component cannot set cookies; the proxy (proxy.ts) refreshes the session before it renders.
        }
      },
    },
  })
}

/** The signed-in visitor, checked with Supabase (not just read from the cookie); null when signed out or sign-in is off. */
export async function currentUser() {
  const client = await authClient()
  if (!client) return { client: null, user: null }
  const { data } = await client.auth.getUser()
  return { client, user: data.user ?? null }
}
