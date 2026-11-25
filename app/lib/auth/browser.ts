'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

let client: SupabaseClient | null = null

/** The one browser Supabase client for sign-in (session in cookies, shared with the server). null when sign-in is off. */
export function browserAuth(): SupabaseClient | null {
  if (!AUTH_ENABLED) return null
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

/** Opens Google's sign-in. After it, the visitor lands on `next` (this page by default); `save` = a search to save right then. */
export async function signInWithGoogle(options: { next?: string; save?: string } = {}): Promise<string | null> {
  const auth = browserAuth()
  if (!auth) return 'Sign-in is not available.'
  const callback = new URL('/auth/callback', window.location.origin)
  callback.searchParams.set('next', options.next ?? `${window.location.pathname}${window.location.search}`)
  if (options.save) callback.searchParams.set('save', options.save)
  const { error } = await auth.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback.toString() } })
  return error ? 'Could not open Google sign-in. Please try again.' : null
}
