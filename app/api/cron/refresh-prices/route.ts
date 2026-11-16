import { NextResponse } from 'next/server'
import { HOME_AIRPORTS } from '../../../homeAirports'
import { DESTINATIONS } from '../../../destinationsList'
import { fetchMonthSummary, fetchRouteMonth } from '../../../lib/tpV3'
import { mapWithLimit } from '../../../lib/pool'
import {
  addJobs,
  claimJobs,
  cleanup,
  countJobs,
  createRun,
  finishJob,
  getRun,
  latestRun,
  setCoverage,
  updateRun,
  upsertTickets,
  SUMMARY_DESTINATION,
  type NewJob,
  type PriceJob,
} from '../../../lib/priceStore'

// The nightly price refresh (vercel.json): fills the price store for BTS, VIE, BUD, KSC and PRG.
//  1. For every airport and month (this month and the next MONTHS_AHEAD): the month summary, every destination with its
//     cheapest ticket, one way and round trip (2 requests per airport and month).
//  2. For the destinations the site names and the TOP_PER_SUMMARY cheapest of each summary: every day of the route-month.
//     For the named ones and the RETURN_TOP cheapest: also the one-way flights BACK (city to home airport), which the
//     return calendars, "find a flight back" and the different-airport trips need.
//  3. Tickets of departed days and old log rows are removed.
// A run is a list of jobs in the store (price_jobs), worked in time-boxed slices: when the budget of one function call is
// used up and work remains, the function calls itself for the next slice (`?run=ID`). So it fits both the 60 s and the
// 300 s function limits, and a run that breaks off is visible in price_runs and continues on the next call.
// Requests are paced (MIN_GAP_MS between starts, WORKERS at a time) to stay far below the price service's limit of about
// 300 requests per minute per method. Vercel's Hobby plan runs a cron once a day; this is the second cron of the project.

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MONTHS_AHEAD = 3
const TOP_PER_SUMMARY = 30
const RETURN_TOP = 10
const MIN_GAP_MS = 320 // ≤ ~190 requests per minute
const WORKERS = 3
const CLAIM = 12
const MAX_SLICES = 60
const MAX_ATTEMPTS = 3
const STALE_RUN_MS = 30 * 60e3
const DEFAULT_BUDGET_MS = 50_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function monthOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** This month and the next MONTHS_AHEAD months (YYYY-MM). */
export function monthsToCover(now = new Date()): string[] {
  const out: string[] = []
  for (let i = 0; i <= MONTHS_AHEAD; i++) out.push(monthOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1))))
  return out
}

function summaryJobs(months: string[]): NewJob[] {
  const jobs: NewJob[] = []
  for (const origin of HOME_AIRPORTS) for (const month of months) for (const one_way of [true, false]) jobs.push({ kind: 'summary', origin, destination: null, month, one_way })
  return jobs
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = process.env.TRAVELPAYOUTS_TOKEN
  const started = Date.now()
  const budget = Number(process.env.PRICE_REFRESH_BUDGET_MS) || DEFAULT_BUDGET_MS
  const timeLeft = () => budget - (Date.now() - started)
  const url = new URL(request.url)
  const now = new Date()
  const months = monthsToCover(now)
  const namedDestinations = DESTINATIONS.map((d) => d.code)

  // The run: continue the one named in the address, or start a new one (unless one is still running).
  let runId = Number(url.searchParams.get('run')) || null
  if (runId) {
    const run = await getRun(runId)
    if (!run || run.status !== 'running') return NextResponse.json({ error: `run ${runId} is not running` }, { status: 409 })
  } else {
    const last = await latestRun()
    if (last && last.status === 'running') {
      if (Date.now() - Date.parse(last.started_at) < STALE_RUN_MS) {
        return NextResponse.json({ skipped: 'a run is in progress', run: last.id }, { status: 409 })
      }
      await updateRun(last.id, { status: 'failed', finished_at: new Date().toISOString(), note: 'abandoned: no slice finished it (the chained call did not arrive?)' })
    }
    runId = await createRun()
    if (!runId) return NextResponse.json({ error: 'could not create a run (is the price store SQL applied?)' }, { status: 500 })
    const planned = await addJobs(runId, summaryJobs(months))
    if (planned) {
      await updateRun(runId, { status: 'failed', finished_at: new Date().toISOString(), note: `could not plan the work: ${planned}` })
      return NextResponse.json({ error: planned, run: runId }, { status: 500 })
    }
  }

  let requests = 0
  let tickets = 0
  let lastError: string | null = null
  let nextStart = 0
  const gate = async () => {
    const wait = nextStart - Date.now()
    nextStart = Math.max(Date.now(), nextStart) + MIN_GAP_MS
    if (wait > 0) await sleep(wait)
  }

  const work = async (job: PriceJob) => {
    if (timeLeft() < 3000) return // left pending for the next slice
    await gate()
    requests++
    const answer =
      job.kind === 'summary'
        ? await fetchMonthSummary(job.origin, job.month, job.one_way, token)
        : await fetchRouteMonth(job.origin, job.destination ?? '', job.month, job.one_way, token)
    if (!answer.ok) {
      const attempts = job.attempts + 1
      lastError = `${job.kind} ${job.origin}-${job.destination ?? '*'} ${job.month} ${job.one_way ? 'one way' : 'round trip'}: ${answer.error}`
      const retry = attempts < MAX_ATTEMPTS
      await finishJob(job.id, retry ? 'pending' : 'failed', attempts, answer.error)
      if (answer.status === 429) await sleep(5000) // the price service asked for a pause
      return
    }
    const written = await upsertTickets(answer.tickets)
    if (written.error) {
      lastError = `store: ${written.error}`
      await finishJob(job.id, job.attempts + 1 < MAX_ATTEMPTS ? 'pending' : 'failed', job.attempts + 1, written.error)
      return
    }
    tickets += written.written
    await setCoverage(job.origin, job.destination ?? SUMMARY_DESTINATION, job.month, job.one_way, answer.tickets.length, 'nightly')
    if (job.kind === 'summary') {
      // Day-level work for the named destinations and the cheapest ones of this summary.
      const cheapest = answer.tickets
        .slice()
        .sort((a, b) => a.price - b.price)
        .map((t) => t.destination)
      const wanted = new Set<string>([...namedDestinations, ...cheapest.slice(0, TOP_PER_SUMMARY)])
      wanted.delete(job.origin)
      const routeJobs: NewJob[] = Array.from(wanted).map((destination) => ({ kind: 'route', origin: job.origin, destination, month: job.month, one_way: job.one_way }))
      if (job.one_way) {
        // The way back is always a one-way ticket from the city to the home airport (a round-trip ticket already holds its return).
        const back = new Set<string>([...namedDestinations, ...cheapest.slice(0, RETURN_TOP)])
        back.delete(job.origin)
        for (const city of back) routeJobs.push({ kind: 'route', origin: city, destination: job.origin, month: job.month, one_way: true })
      }
      const err = await addJobs(runId as number, routeJobs)
      if (err) lastError = `planning routes: ${err}`
    }
    await finishJob(job.id, 'done', job.attempts + 1, null)
  }

  while (timeLeft() > 5000) {
    const jobs = await claimJobs(runId, CLAIM)
    if (jobs.length === 0) break
    await mapWithLimit(jobs, WORKERS, work)
  }

  const run = await getRun(runId)
  const counts = await countJobs(runId)
  const slices = (run?.slices ?? 0) + 1
  const patch = {
    slices,
    requests: (run?.requests ?? 0) + requests,
    tickets: (run?.tickets ?? 0) + tickets,
    jobs_pending: counts.pending,
    jobs_failed: counts.failed,
    note: lastError ?? run?.note ?? null,
  }

  if (counts.pending > 0 && slices < MAX_SLICES) {
    await updateRun(runId, patch)
    const next = await continueRun(request, runId)
    console.log(`refresh-prices: run ${runId} slice ${slices}, ${requests} requests, ${tickets} tickets, ${counts.pending} jobs pending, next slice ${next}`)
    return NextResponse.json({ run: runId, slice: slices, requests, tickets, pending: counts.pending, continued: next })
  }

  const notes = await cleanup(now.toISOString().slice(0, 10), months[0])
  const status = counts.pending > 0 ? 'failed' : 'done'
  await updateRun(runId, { ...patch, status, finished_at: new Date().toISOString(), note: [patch.note, ...notes].filter(Boolean).join('; ') })
  console.log(`refresh-prices: run ${runId} ${status} after ${slices} slice(s): ${patch.requests} requests, ${patch.tickets} tickets, ${counts.failed} jobs failed; ${notes.join('; ')}`)
  return NextResponse.json({ run: runId, status, slices, requests: patch.requests, tickets: patch.tickets, failed: counts.failed, notes })
}

/** Asks this same function for the next slice. The call is let go after a few seconds: the new call runs on its own. */
async function continueRun(request: Request, runId: number): Promise<string> {
  const base = process.env.PRICE_REFRESH_SELF_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : new URL(request.url).origin)
  const headers: Record<string, string> = { authorization: `Bearer ${process.env.CRON_SECRET}` }
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(`${base}/api/cron/refresh-prices?run=${runId}`, { headers, signal: controller.signal, cache: 'no-store' })
    return `started (HTTP ${res.status})`
  } catch (e) {
    return (e as Error).name === 'AbortError' ? 'started (call let go)' : `could not start: ${(e as Error).message}`
  } finally {
    clearTimeout(timer)
  }
}
