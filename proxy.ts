// Keeps a signed-in visitor's session fresh on the few addresses that read it on the server (/saved, its API and the sign-in
// return). It runs NOWHERE else, so every other page is served exactly as before. Off when sign-in is off.

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from './app/lib/auth/config'

export async function proxy(request: NextRequest) {
  if (!AUTH_ENABLED) return NextResponse.next()
  let response = NextResponse.next({ request })
  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of list) response.cookies.set(name, value, options)
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value)
      },
    },
  })
  // Asking for the user refreshes an expired access token (and writes the new cookies above).
  await client.auth.getUser()
  return response
}

export const config = {
  matcher: ['/saved', '/api/saved'],
}
