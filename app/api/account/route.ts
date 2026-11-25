// "Delete my account" (/saved): deletes the signed-in visitor's saved routes and their Supabase Auth account, then clears the
// sign-in cookie. The saved routes go first with the visitor's own client (RLS: own rows only); the account itself can only be
// removed with the service key, and only for the id Supabase just confirmed for this session. 404 when sign-in is off.

import { NextResponse } from 'next/server'
import { AUTH_ENABLED } from '../../lib/auth/config'
import { currentUser } from '../../lib/auth/server'
import { supabaseAdmin } from '../../supabaseAdmin'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

export async function DELETE(request: Request) {
  if (!AUTH_ENABLED) return json({ error: 'Not found' }, 404)

  // Only our own pages may ask (a form on another site cannot delete someone's account).
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'Not allowed' }, 403)
  const body = await request.json().catch(() => null)
  if (body?.confirm !== 'delete my account') return json({ error: 'Please confirm first.' }, 400)

  const { client, user } = await currentUser()
  if (!client || !user) return json({ error: 'Sign in first.' }, 401)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[account] cannot delete: SUPABASE_SERVICE_ROLE_KEY is missing')
    return json({ error: 'Deleting accounts is not available right now. Please write to us instead.' }, 500)
  }

  // Missing table (saved_routes.sql not run) = nothing to delete; any other problem stops here, before the account goes.
  const routes = await client.from('saved_routes').delete().eq('user_id', user.id)
  if (routes.error && routes.error.code !== '42P01' && routes.error.code !== 'PGRST205') {
    console.error('[account] saved routes not deleted', routes.error.code, routes.error.message)
    return json({ error: 'Could not delete your saved routes. Nothing was deleted; please try again.' }, 500)
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('[account] account not deleted', error.status, error.message)
    return json({ error: 'Your saved routes are deleted, but the account could not be. Please try again.' }, 500)
  }

  // The session belongs to a deleted account now: remove its cookies here (no call to Supabase needed).
  await client.auth.signOut({ scope: 'local' }).catch(() => {})
  return json({ ok: true })
}
