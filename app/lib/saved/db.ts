// Reads and writes of saved_routes, always with the SIGNED-IN VISITOR's client (lib/auth/server.ts), so Row Level Security
// (supabase/saved_routes.sql) limits every call to their own rows. user_id is filled in by the database (auth.uid()).

import type { SupabaseClient } from '@supabase/supabase-js'
import { fromRow, toRow, type SavedRow, type SavedSearch } from './search'
import { priceNow } from './price'

const COLUMNS = 'id, origins, destination, one_way, date_mode, date_from, date_to, min_nights, max_nights, saved_price, saved_price_seen_at, created_at'

export const MAX_SAVED = 100

/** A database answer as a plain-language problem; "missing" = the table was never created (saved_routes.sql not run). */
export type DbProblem = 'missing' | 'limit' | 'failed'

function problemOf(error: { code?: string; message?: string }): DbProblem {
  if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? '')) return 'missing'
  if (/at most 100/.test(error.message ?? '')) return 'limit'
  return 'failed'
}

export async function listSaved(client: SupabaseClient): Promise<{ rows: SavedRow[]; problem: DbProblem | null }> {
  const { data, error } = await client.from('saved_routes').select(COLUMNS).order('created_at', { ascending: false }).limit(MAX_SAVED)
  if (error) {
    console.error('[saved] list failed', error.code, error.message)
    return { rows: [], problem: problemOf(error) }
  }
  return { rows: (data ?? []).map(fromRow), problem: null }
}

/** The id of this exact search when it is already saved. */
export async function findSaved(client: SupabaseClient, s: SavedSearch): Promise<{ id: number | null; problem: DbProblem | null }> {
  const row = toRow(s)
  let q = client.from('saved_routes').select('id').eq('origins', row.origins).eq('destination', row.destination).eq('one_way', row.one_way).eq('date_mode', row.date_mode)
  for (const key of ['date_from', 'date_to', 'min_nights', 'max_nights'] as const) {
    const v = row[key]
    q = v === null ? q.is(key, null) : q.eq(key, v)
  }
  const { data, error } = await q.limit(1).maybeSingle()
  if (error) return { id: null, problem: problemOf(error) }
  return { id: (data as { id: number } | null)?.id ?? null, problem: null }
}

/** Saves a search with today's price for it. Saving one that is already saved is not an error: its id comes back. */
export async function addSaved(client: SupabaseClient, s: SavedSearch): Promise<{ id: number | null; problem: DbProblem | null }> {
  const existing = await findSaved(client, s)
  if (existing.problem || existing.id !== null) return existing
  const price = await priceNow(s)
  const { data, error } = await client
    .from('saved_routes')
    .insert({
      ...toRow(s),
      saved_price: price.kind === 'price' ? price.price : null,
      saved_price_seen_at: price.kind === 'price' ? price.seenAt : null,
    })
    .select('id')
    .single()
  if (error) {
    // Saved a moment ago in another tab: the unique key refused the copy.
    if (error.code === '23505') return findSaved(client, s)
    console.error('[saved] insert failed', error.code, error.message)
    return { id: null, problem: problemOf(error) }
  }
  return { id: (data as { id: number }).id, problem: null }
}

export async function deleteSaved(client: SupabaseClient, id: number): Promise<DbProblem | null> {
  const { error } = await client.from('saved_routes').delete().eq('id', id)
  if (error) {
    console.error('[saved] delete failed', error.code, error.message)
    return problemOf(error)
  }
  return null
}
