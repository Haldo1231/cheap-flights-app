// Google sends the visitor back here after sign-in. The one-time code becomes the session cookie; a search the visitor
// wanted to save before signing in (`save`, see SaveButton) is saved now; then back to the page they came from (`next`).

import { NextResponse } from 'next/server'
import { AUTH_ENABLED, safeNext } from '../../lib/auth/config'
import { authClient } from '../../lib/auth/server'
import { cleanSearch } from '../../lib/saved/search'
import { addSaved } from '../../lib/saved/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('next'))
  const back = (path: string) => NextResponse.redirect(new URL(path, url.origin), { headers: { 'Cache-Control': 'private, no-store' } })
  if (!AUTH_ENABLED) return back('/')

  const code = url.searchParams.get('code')
  const client = await authClient()
  if (!code || !client) return back('/saved?signin=failed')
  const { error } = await client.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth] sign-in did not finish', error.code ?? error.name)
    return back('/saved?signin=failed')
  }

  const raw = url.searchParams.get('save')
  if (raw) {
    let parsed: unknown = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
    const search = cleanSearch(parsed)
    if (search) await addSaved(client, search)
  }
  return back(next)
}
