// The price store: cached Travelpayouts tickets in Supabase (tables in supabase/price_store.sql). Server code only.
// One row = one ticket: the cheapest the price service knows for a route, a departure day and (round trips) a return
// day. `found_at` is when THIS site got the ticket from the price service; the screens show it as "price seen X h ago".

import { supabaseAdmin } from '../supabaseAdmin'

export type TicketSource = 'month-cheapest' | 'route-month' | 'live'

export type StoreTicket = {
  origin: string
  destination: string
  destination_airport: string | null
  /** Local departure time exactly as the price service gives it, e.g. 2026-12-12T06:50:00+01:00. */
  departure_at: string
  departure_date: string
  return_at: string | null
  return_date: string | null
  one_way: boolean
  price: number
  airline: string | null
  flight_number: string | null
  transfers: number | null
  return_transfers: number | null
  duration: number | null
  gate: string | null
  /** Aviasales deep link to this exact ticket (a path), when the service gives one. */
  link: string | null
  month: string
  source: TicketSource
  found_at: string
}

/** The coverage row of an airport's month summary (all destinations at once) uses this as its destination. */
export const SUMMARY_DESTINATION = '*'

export type Coverage = { origin: string; destination: string; month: string; one_way: boolean; fetched_at: string; tickets: number; source: string }

export type PriceJob = {
  id: number
  run_id: number
  kind: 'summary' | 'route'
  origin: string
  destination: string | null
  month: string
  one_way: boolean
  status: 'pending' | 'done' | 'failed'
  attempts: number
  error: string | null
}

export type PriceRun = {
  id: number
  started_at: string
  finished_at: string | null
  status: 'running' | 'done' | 'failed'
  slices: number
  requests: number
  tickets: number
  jobs_pending: number
  jobs_failed: number
  note: string | null
}

const CHUNK = 500
const TICKET_KEY = 'origin,destination,departure_date,return_date,one_way'

export function ticketKey(t: Pick<StoreTicket, 'origin' | 'destination' | 'departure_date' | 'return_date' | 'one_way'>): string {
  return `${t.origin}|${t.destination}|${t.departure_date}|${t.return_date ?? ''}|${t.one_way ? 1 : 0}`
}

/** One row per ticket key, the cheapest kept (a batch must not hold the same key twice). */
export function dedupeTickets(tickets: StoreTicket[]): StoreTicket[] {
  const best = new Map<string, StoreTicket>()
  for (const t of tickets) {
    const k = ticketKey(t)
    const have = best.get(k)
    if (!have || t.price < have.price) best.set(k, t)
  }
  return Array.from(best.values())
}

/** Writes tickets, replacing the ticket of the same route, day and return day. */
export async function upsertTickets(tickets: StoreTicket[]): Promise<{ written: number; error: string | null }> {
  const rows = dedupeTickets(tickets)
  let written = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabaseAdmin.from('price_tickets').upsert(chunk, { onConflict: TICKET_KEY })
    if (error) return { written, error: error.message }
    written += chunk.length
  }
  return { written, error: null }
}

export async function setCoverage(origin: string, destination: string, month: string, oneWay: boolean, tickets: number, source: 'nightly' | 'live'): Promise<string | null> {
  const { error } = await supabaseAdmin
    .from('price_coverage')
    .upsert({ origin, destination, month, one_way: oneWay, fetched_at: new Date().toISOString(), tickets, source }, { onConflict: 'origin,destination,month,one_way' })
  return error ? error.message : null
}

/** The coverage rows of several airports for one destination and month (or the month summaries with SUMMARY_DESTINATION). */
export async function getCoverage(origins: string[], destination: string, month: string, oneWay: boolean): Promise<Coverage[]> {
  const { data, error } = await supabaseAdmin
    .from('price_coverage')
    .select('origin, destination, month, one_way, fetched_at, tickets, source')
    .in('origin', origins)
    .eq('destination', destination)
    .eq('month', month)
    .eq('one_way', oneWay)
  if (error || !data) return []
  return data as Coverage[]
}

/** Every stored ticket of a route-month from the given airports, cheapest first. */
export async function readRouteMonth(origins: string[], destination: string, month: string, oneWay: boolean): Promise<StoreTicket[]> {
  const { data, error } = await supabaseAdmin
    .from('price_tickets')
    .select('*')
    .in('origin', origins)
    .eq('destination', destination)
    .eq('month', month)
    .eq('one_way', oneWay)
    .order('price', { ascending: true })
    .limit(5000)
  if (error || !data) return []
  return data as StoreTicket[]
}

/** For each airport and destination, the cheapest stored ticket of a month (the overview question, one query). */
export async function readOverview(origins: string[], month: string, oneWay: boolean): Promise<StoreTicket[]> {
  const { data, error } = await supabaseAdmin.rpc('price_overview', { p_origins: origins, p_month: month, p_one_way: oneWay })
  if (error || !data) return []
  return data as StoreTicket[]
}

// ---- the nightly job's log and work list ----

export async function createRun(): Promise<number | null> {
  const { data, error } = await supabaseAdmin.from('price_runs').insert({}).select('id').single()
  return error || !data ? null : (data.id as number)
}

export async function getRun(id: number): Promise<PriceRun | null> {
  const { data, error } = await supabaseAdmin.from('price_runs').select('*').eq('id', id).maybeSingle()
  return error || !data ? null : (data as PriceRun)
}

export async function latestRun(): Promise<PriceRun | null> {
  const { data, error } = await supabaseAdmin.from('price_runs').select('*').order('id', { ascending: false }).limit(1).maybeSingle()
  return error || !data ? null : (data as PriceRun)
}

export async function updateRun(id: number, patch: Partial<Omit<PriceRun, 'id'>>): Promise<string | null> {
  const { error } = await supabaseAdmin.from('price_runs').update(patch).eq('id', id)
  return error ? error.message : null
}

export type NewJob = { kind: 'summary' | 'route'; origin: string; destination: string | null; month: string; one_way: boolean }

/** Adds work to a run; a piece of work that is already there is left alone. */
export async function addJobs(runId: number, jobs: NewJob[]): Promise<string | null> {
  if (jobs.length === 0) return null
  const rows = jobs.map((j) => ({ ...j, run_id: runId }))
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabaseAdmin.from('price_jobs').upsert(rows.slice(i, i + CHUNK), { onConflict: 'run_id,kind,origin,destination,month,one_way', ignoreDuplicates: true })
    if (error) return error.message
  }
  return null
}

/** The next pending pieces of work, oldest first (summaries are planned first, so they come first). */
export async function claimJobs(runId: number, limit: number): Promise<PriceJob[]> {
  const { data, error } = await supabaseAdmin.from('price_jobs').select('*').eq('run_id', runId).eq('status', 'pending').order('id', { ascending: true }).limit(limit)
  if (error || !data) return []
  return data as PriceJob[]
}

export async function finishJob(id: number, status: PriceJob['status'], attempts: number, error: string | null): Promise<void> {
  await supabaseAdmin.from('price_jobs').update({ status, attempts, error, done_at: status === 'pending' ? null : new Date().toISOString() }).eq('id', id)
}

export async function countJobs(runId: number): Promise<{ pending: number; failed: number }> {
  const count = async (status: string) => {
    const { count } = await supabaseAdmin.from('price_jobs').select('*', { count: 'exact', head: true }).eq('run_id', runId).eq('status', status)
    return count ?? 0
  }
  return { pending: await count('pending'), failed: await count('failed') }
}

/** Removes what can no longer be shown or is no longer needed. Returns one line per step for the log. */
export async function cleanup(today: string, currentMonth: string, keepRunsDays = 14): Promise<string[]> {
  const notes: string[] = []
  const departed = await supabaseAdmin.from('price_tickets').delete({ count: 'exact' }).lt('departure_date', today)
  notes.push(departed.error ? `departed tickets: ${departed.error.message}` : `departed tickets removed: ${departed.count ?? 0}`)
  const oldMonths = await supabaseAdmin.from('price_coverage').delete({ count: 'exact' }).lt('month', currentMonth)
  notes.push(oldMonths.error ? `old coverage: ${oldMonths.error.message}` : `old coverage rows removed: ${oldMonths.count ?? 0}`)
  const cutoff = new Date(Date.now() - keepRunsDays * 86400e3).toISOString()
  const runs = await supabaseAdmin.from('price_runs').delete({ count: 'exact' }).lt('started_at', cutoff)
  notes.push(runs.error ? `old runs: ${runs.error.message}` : `old runs removed: ${runs.count ?? 0}`)
  return notes
}

export async function storeStats(): Promise<{ table_name: string; row_count: number; bytes: number }[]> {
  const { data, error } = await supabaseAdmin.rpc('price_store_stats')
  return error || !data ? [] : (data as { table_name: string; row_count: number; bytes: number }[])
}
