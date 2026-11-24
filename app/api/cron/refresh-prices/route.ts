import { NextResponse, after } from 'next/server'
import { HOME_AIRPORTS } from '../../../homeAirports'
import { DESTINATIONS } from '../../../destinationsList'
import { fetchMonthSummary, fetchRouteMonth } from '../../../lib/tpV3'
import { mapWithLimit } from '../../../lib/pool'
import { coveredMonths } from '../../../lib/priceSource'
import {
  addJobs,
  claimJobs,
  cleanup,
  countJobs,
  createRun,
  finishJob,
  getRun,
  latestRun,
  requeueFailedJobs,
  setCoverage,
  updateRun,
  upsertTickets,
  SUMMARY_DESTINATION,
  type NewJob,
  type PriceJob,
} from '../../../lib/priceStore'
import { appendNote, getRunWithRetry, lastProgress, RESUME_WITHIN_MS, selfBase, startSlice, STUCK_AFTER_MS, TOTAL_ATTEMPTS } from '../../../lib/priceRun'

// The nightly price refresh (vercel.json): fills the price store for BTS, VIE, BUD, KSC and PRG.
//  1. For every airport and month (this month and the next MONTHS_AHEAD of priceSource): the month summary, every destination with its
//     cheapest ticket, one way and round trip (2 requests per airport and month).
//  2. For the destinations the site names and the TOP_PER_SUMMARY cheapest of each summary: every day of the route-month,
//     in all three kinds a screen can ask for (round-trip tickets out, one-way tickets out, one-way tickets BACK from the
//     city to the home airport), so a default search is answered from the store alone.
//  3. Tickets of departed days and old log rows are removed.
// A run is a list of jobs in the store (price_jobs), worked in time-boxed slices: when the budget of one function call is
// used up and work remains, the function calls itself for the next slice (`?run=ID`). Every call answers 202 ("accepted")
// at once and does its slice afterwards (`after()`, same time limit as the function), so the caller KNOWS the next slice
// started; it tries up to three times (`startSlice` in lib/priceRun.ts). A run that still stops (no progress for 30 min) is
// resumed by the daily deals job (`resumeStuckRun`) or by the next call of this job. Failed jobs get a second round at the end.
// Requests are paced (MIN_GAP_MS between starts, WORKERS at a time) to stay far below the price service's limit of about
// 300 requests per minute per method. Vercel's Hobby plan runs a cron once a day; this is the second cron of the project.

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const TOP_PER_SUMMARY = 25
const MIN_GAP_MS = 320 // ≤ ~190 requests per minute
const WORKERS = 3
const CLAIM = 12
const MAX_SLICES = 60
const MAX_ATTEMPTS = 3 // tries inside the slices; failed jobs then get TOTAL_ATTEMPTS - MAX_ATTEMPTS more at the end of the run
const RETRY_PAUSE_MS = 10_000
// How long one slice may work before it hands over. Kept well under `maxDuration` (300 s): after the budget is used up a
// slice still has to write its counters, may pause RETRY_PAUSE_MS for a round of failed jobs, and then wait for the next
// slice to confirm it started (`startSlice`: 3 tries, up to ~73 s all told). 180 s + that tail stays inside 300 s.
// WHY SO BIG: Vercel answers a slice's call to the next slice with HTTP 508 (`INFINITE_LOOP_DETECTED`, "an infinite loop is
// detected within the application") once a chain has made roughly 8 of them, so every night from 18 to 24 Nov 2026 the run
// stopped after 9 slices with ~1,100 jobs never done (runs 5-11 in `price_runs`). Vercel documents no count for when 508
// starts, so the fix is to need far fewer calls: ~2,250 requests paced at MIN_GAP_MS take about 12 min, which is ~5 slices
// of 180 s instead of ~20 of 50 s.
const DEFAULT_BUDGET_MS = 180_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** What a slice still has to do after its budget is used up: write the counters, maybe pause for a round of failed jobs, and
 * wait for the next slice to confirm it started (3 tries). The function is killed at `maxDuration`, so the budget must leave
 * room for all of it -- a budget set too high would cut a slice off mid-hand-over and stall the run. */
const HANDOVER_TAIL_MS = RETRY_PAUSE_MS + 75_000

/** The budget a slice may use, never so much that the hand-over cannot finish inside `maxDuration`. */
function sliceBudget(wanted: number, maxMs = maxDuration * 1000): number {
  return Math.max(10_000, Math.min(wanted, maxMs - HANDOVER_TAIL_MS))
}

/** The 40 summary jobs, in the order a slice will work them. That order decides the order the route jobs are planned in, and
 * `claimJobs` takes pending jobs oldest id first -- so when a chain of slices stops early, the order is exactly what the night
 * sacrifices. MONTH FIRST, with the airport list rotated by one month after month: every airport gets its nearest months
 * planned early, and no airport is last in every month.
 * WHY: until 24 Nov 2026 this loop was airport-major (all of Bratislava's months, then Vienna's, ...), so while the HTTP 508
 * bug stopped every run after 9 of ~20 slices, the jobs that never ran were always the same ones -- Košice and Prague.
 * Measured on 24 Nov 2026: average age of a stored route-month was 36 h for Vienna and 45 h for Bratislava against 154 h for
 * Košice and Prague, and run 11 had 1 of ~70 Košice jobs done per month. A partial night now leaves far months stale instead
 * of starving two airports for a week. */
export function summaryJobs(months: string[]): NewJob[] {
  const jobs: NewJob[] = []
  months.forEach((month, monthIndex) => {
    for (let i = 0; i < HOME_AIRPORTS.length; i++) {
      const origin = HOME_AIRPORTS[(i + monthIndex) % HOME_AIRPORTS.length]
      for (const one_way of [true, false]) jobs.push({ kind: 'summary', origin, destination: null, month, one_way })
    }
  })
  return jobs
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = new URL(request.url)
  const base = selfBase(request.url)

  // The run: continue the one named in the address, resume a stuck one, or start a new one.
  let runId = Number(url.searchParams.get('run')) || null
  let how = 'continued'
  if (runId) {
    const run = await getRunWithRetry(runId)
    if (!run || run.status !== 'running') return NextResponse.json({ error: `run ${runId} is not running` }, { status: 409 })
  } else {
    const last = await latestRun()
    if (last && last.status === 'running') {
      const idle = Date.now() - (await lastProgress(last))
      if (idle < STUCK_AFTER_MS) return NextResponse.json({ skipped: 'a run is in progress', run: last.id }, { status: 409 })
      if (Date.now() - Date.parse(last.started_at) < RESUME_WITHIN_MS) {
        const requeued = await requeueFailedJobs(last.id, TOTAL_ATTEMPTS)
        await updateRun(last.id, { note: appendNote(last.note, `resumed at ${new Date().toISOString().slice(11, 16)} UTC after ${Math.round(idle / 60e3)} min without progress (${requeued} failed jobs back in the queue)`) })
        runId = last.id
        how = 'resumed'
      } else {
        await updateRun(last.id, { status: 'failed', finished_at: new Date().toISOString(), note: appendNote(last.note, `abandoned: no progress for ${Math.round(idle / 60e3)} min`) })
      }
    }
    if (!runId) {
      runId = await createRun()
      if (!runId) return NextResponse.json({ error: 'could not create a run (is the price store SQL applied?)' }, { status: 500 })
      const planned = await addJobs(runId, summaryJobs(coveredMonths(new Date())))
      if (planned) {
        await updateRun(runId, { status: 'failed', finished_at: new Date().toISOString(), note: `could not plan the work: ${planned}` })
        return NextResponse.json({ error: planned, run: runId }, { status: 500 })
      }
      how = 'started'
    }
  }

  // Answer first ("accepted": the caller now knows this slice runs), then work.
  const id = runId
  after(async () => {
    try {
      await runSlice(id, base)
    } catch (e) {
      const message = (e as Error).message
      console.error(`refresh-prices: run ${id} slice crashed: ${message}`)
      const run = await getRun(id)
      await updateRun(id, { note: appendNote(run?.note ?? null, `slice crashed: ${message.slice(0, 200)} (the watchdog resumes the run)`) })
    }
  })
  return NextResponse.json({ run: runId, accepted: how }, { status: 202 })
}

/** One time-boxed slice of a run: works pending jobs until the budget is used, then hands over to the next slice, gives the
 * failed jobs one more round, or finishes the run. */
async function runSlice(runId: number, base: string): Promise<void> {
  const token = process.env.TRAVELPAYOUTS_TOKEN
  const started = Date.now()
  const budget = sliceBudget(Number(process.env.PRICE_REFRESH_BUDGET_MS) || DEFAULT_BUDGET_MS)
  const timeLeft = () => budget - (Date.now() - started)
  const now = new Date()
  const months = coveredMonths(now)
  const namedDestinations = DESTINATIONS.map((d) => d.code)

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
        ? await fetchMonthSummary(job.origin, job.month, job.one_way, token, { fresh: true })
        : await fetchRouteMonth(job.origin, job.destination ?? '', job.month, job.one_way, token, 'route-month', { fresh: true })
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
      const routeJobs: NewJob[] = []
      for (const destination of wanted) {
        routeJobs.push({ kind: 'route', origin: job.origin, destination, month: job.month, one_way: true })
        routeJobs.push({ kind: 'route', origin: job.origin, destination, month: job.month, one_way: false })
        // The way back is always a one-way ticket from the city to the home airport (a round-trip ticket already holds its return).
        routeJobs.push({ kind: 'route', origin: destination, destination: job.origin, month: job.month, one_way: true })
      }
      const err = await addJobs(runId, routeJobs)
      if (err) lastError = `planning routes: ${err}`
    }
    await finishJob(job.id, 'done', job.attempts + 1, null)
  }

  while (timeLeft() > 5000) {
    const jobs = await claimJobs(runId, CLAIM)
    if (jobs.length === 0) break
    await mapWithLimit(jobs, WORKERS, work)
  }

  const run = await getRunWithRetry(runId)
  let counts = await countJobs(runId)
  if (!counts.ok) counts = await countJobs(runId)
  if (!run || !counts.ok) {
    // The store did not answer: never finish or rewrite the run on guesses. Hand over, so the work goes on; the counters
    // are corrected by the next slice that can read them.
    const next = await startSlice(base, runId)
    console.error(`refresh-prices: run ${runId}: could not read the run or its job counts after a slice (${requests} requests, ${tickets} tickets); ${next.detail}`)
    return
  }
  const slices = run.slices + 1
  let note = lastError ? appendNote(run.note, lastError) : run.note
  const patch = () => ({
    slices,
    requests: run.requests + requests,
    tickets: run.tickets + tickets,
    jobs_pending: counts.pending,
    jobs_failed: counts.failed,
    note,
  })

  // Nothing pending but some jobs failed three times: one more round for them (after a pause), up to TOTAL_ATTEMPTS each.
  if (counts.pending === 0 && counts.failed > 0 && slices < MAX_SLICES) {
    const requeued = await requeueFailedJobs(runId, TOTAL_ATTEMPTS)
    if (requeued > 0) {
      counts.pending = requeued
      counts.failed -= requeued
      note = appendNote(note, `${requeued} failed jobs put back for another try`)
      await sleep(RETRY_PAUSE_MS)
    }
  }

  if (counts.pending > 0 && slices < MAX_SLICES) {
    await updateRun(runId, patch())
    const next = await startSlice(base, runId)
    if (!next.ok) await updateRun(runId, { note: appendNote(note, `${next.detail} (the watchdog resumes the run)`) })
    console.log(`refresh-prices: run ${runId} slice ${slices}, ${requests} requests, ${tickets} tickets, ${counts.pending} jobs pending, ${next.detail}`)
    return
  }

  const notes = await cleanup(now.toISOString().slice(0, 10), months[0])
  const status = counts.pending > 0 ? 'failed' : 'done'
  await updateRun(runId, { ...patch(), status, finished_at: new Date().toISOString(), note: [note, ...notes].filter(Boolean).join('; ') })
  console.log(`refresh-prices: run ${runId} ${status} after ${slices} slice(s): ${patch().requests} requests, ${patch().tickets} tickets, ${counts.failed} jobs failed; ${notes.join('; ')}`)
}
