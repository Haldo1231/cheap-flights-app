// Sign-in (Supabase Auth with Google) is OFF unless NEXT_PUBLIC_GOOGLE_SIGN_IN is "on" AND the Supabase address and public
// key are set. Off = no "Sign in" button, no heart buttons, /saved is a 404, and the rest of the site works exactly as before.
// The values are read at build time (NEXT_PUBLIC_*), so changing them needs a new deployment.

export const AUTH_ENABLED =
  process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === 'on' &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** A "come back here" path from untrusted input: only a path on this site ("/x"), never "//other.site" or a full address. */
export function safeNext(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  return raw
}
