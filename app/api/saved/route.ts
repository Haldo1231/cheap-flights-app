// The heart button's requests. GET ?<search> = is this search saved (and is anyone signed in); POST {search} = save it;
// DELETE ?id= = remove a saved search. Everything runs as the signed-in visitor, so RLS keeps it to their own rows.
// 404 when sign-in is off (lib/auth/config.ts).

import { NextResponse } from 'next/server'
import { AUTH_ENABLED } from '../../lib/auth/config'
import { currentUser } from '../../lib/auth/server'
import { cleanSearch } from '../../lib/saved/search'
import { addSaved, deleteSaved, findSaved, type DbProblem } from '../../lib/saved/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })
const off = () => json({ error: 'Not found' }, 404)

const MESSAGES: Record<DbProblem, string> = {
  missing: 'Saving routes is not set up yet.',
  limit: 'You can keep up to 100 saved routes. Remove one first.',
  failed: 'Could not save right now. Please try again.',
}

export async function GET(request: Request) {
  if (!AUTH_ENABLED) return off()
  const params = new URL(request.url).searchParams
  const search = cleanSearch(Object.fromEntries(params))
  const { client, user } = await currentUser()
  if (!client || !user) return json({ signedIn: false, id: null })
  if (!search) return json({ signedIn: true, id: null })
  const { id } = await findSaved(client, search)
  return json({ signedIn: true, id })
}

export async function POST(request: Request) {
  if (!AUTH_ENABLED) return off()
  const body = await request.json().catch(() => null)
  const search = cleanSearch(body?.search)
  if (!search) return json({ error: 'This search cannot be saved.' }, 400)
  const { client, user } = await currentUser()
  if (!client || !user) return json({ error: 'Sign in to save routes.' }, 401)
  const { id, problem } = await addSaved(client, search)
  if (problem) return json({ error: MESSAGES[problem] }, problem === 'limit' ? 409 : 500)
  return json({ id })
}

export async function DELETE(request: Request) {
  if (!AUTH_ENABLED) return off()
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'Missing id' }, 400)
  const { client, user } = await currentUser()
  if (!client || !user) return json({ error: 'Sign in first.' }, 401)
  const problem = await deleteSaved(client, id)
  if (problem) return json({ error: 'Could not remove it right now. Please try again.' }, 500)
  return json({ ok: true })
}
