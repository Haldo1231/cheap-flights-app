// Keeps the nightly price run (/api/cron/refresh-prices) going: the hand-over from one time-boxed slice to the next, and
// the check that finds a run that stopped half way and starts it again. Used by the price job itself and by the daily
// deals job (the second of the two cron jobs the Hobby plan allows), which doubles as the watchdog.
//
// What went wrong on 17 Nov 2026 (run 3): slice 5 asked for slice 6 and let the call go after 3 seconds without knowing
// whether it arrived; slice 6 never reached the database, and nothing looked at the run again until the next night.
// Now a slice answers "202 accepted" before it starts working (the work runs in `after()`), the caller waits for that
// answer and tries again when it does not come, and the deals job resumes any run that made no progress for 30 minutes.

import { getRun, lastJobDoneAt, latestRun, requeueFailedJobs, updateRun, type PriceRun } from './priceStore'

/** A running run that finished no job for this long is stuck. A slice takes about 50 s, so 30 min is far beyond a slow one.
 * `PRICE_RUN_STUCK_MINUTES` changes it (only for tests; leave it unset on Vercel). */
export const STUCK_AFTER_MS = (Number(process.env.PRICE_RUN_STUCK_MINUTES) || 30) * 60e3
/** A stuck run older than this is given up (the nightly job starts a fresh one) rather than resumed. */
export const RESUME_WITHIN_MS = 20 * 3600e3
/** Tries per job across the whole run: 3 inside the slices, then failed jobs are put back for the rest. */
export const TOTAL_ATTEMPTS = 5

const HANDOVER_TRIES = 3
const HANDOVER_WAIT_MS = 20_000
const HANDOVER_PAUSES_MS = [3_000, 10_000]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The address the price job calls itself on: a fixed one when set, else the production domain, else where the request came in. */
export function selfBase(requestUrl: string): string {
  if (process.env.PRICE_REFRESH_SELF_URL) return process.env.PRICE_REFRESH_SELF_URL.replace(/\/+$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return new URL(requestUrl).origin
}

/** Asks the price job for the next slice of a run and waits until that slice confirms it started (HTTP 202). Tries up to
 * HANDOVER_TRIES times with pauses in between, so one lost call does not stop the run. Returns what happened, for the log. */
export async function startSlice(base: string, runId: number, wait = HANDOVER_WAIT_MS): Promise<{ ok: boolean; detail: string }> {
  const headers: Record<string, string> = { authorization: `Bearer ${process.env.CRON_SECRET}` }
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const problems: string[] = []
  for (let attempt = 1; attempt <= HANDOVER_TRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), wait)
    try {
      const res = await fetch(`${base}/api/cron/refresh-prices?run=${runId}`, { headers, signal: controller.signal, cache: 'no-store' })
      if (res.status === 202) return { ok: true, detail: attempt === 1 ? 'next slice started' : `next slice started on try ${attempt} (${problems.join('; ')})` }
      // 409: the run is not running any more (finished by another slice, or given up): nothing to hand over.
      if (res.status === 409) return { ok: true, detail: `no hand-over needed (HTTP 409: ${(await res.text()).slice(0, 120)})` }
      problems.push(`try ${attempt}: HTTP ${res.status}`)
    } catch (e) {
      problems.push(`try ${attempt}: ${(e as Error).name === 'AbortError' ? `no answer within ${Math.round(wait / 1000)} s` : (e as Error).message}`)
    } finally {
      clearTimeout(timer)
    }
    if (attempt < HANDOVER_TRIES) await sleep(HANDOVER_PAUSES_MS[attempt - 1] ?? 10_000)
  }
  return { ok: false, detail: `hand-over failed: ${problems.join('; ')}` }
}

/** When the run last moved: its newest finished job, or its start. */
export async function lastProgress(run: PriceRun): Promise<number> {
  const done = await lastJobDoneAt(run.id)
  return Math.max(Date.parse(run.started_at), done ? Date.parse(done) : 0)
}

export type StuckCheck =
  | { action: 'none'; detail: string }
  | { action: 'resumed' | 'resume-failed' | 'abandoned'; run: number; detail: string }

/** The watchdog: looks at the newest run and, if it is running but made no progress for STUCK_AFTER_MS, either starts it
 * again (failed jobs back in the queue, next slice asked for) or, when it is older than RESUME_WITHIN_MS, marks it given up so
 * the next nightly call starts a fresh run. Never starts a new run itself. */
export async function resumeStuckRun(base: string, now = Date.now()): Promise<StuckCheck> {
  const run = await latestRun()
  if (!run) return { action: 'none', detail: 'no price run yet' }
  if (run.status !== 'running') return { action: 'none', detail: `latest run ${run.id} is ${run.status}` }
  const idle = now - (await lastProgress(run))
  if (idle < STUCK_AFTER_MS) return { action: 'none', detail: `run ${run.id} is working (last progress ${Math.round(idle / 60e3)} min ago)` }
  if (now - Date.parse(run.started_at) > RESUME_WITHIN_MS) {
    await updateRun(run.id, { status: 'failed', finished_at: new Date(now).toISOString(), note: appendNote(run.note, `abandoned: no progress for ${Math.round(idle / 60e3)} min and older than ${RESUME_WITHIN_MS / 3600e3} h`) })
    return { action: 'abandoned', run: run.id, detail: `run ${run.id} given up (no progress for ${Math.round(idle / 60e3)} min)` }
  }
  const requeued = await requeueFailedJobs(run.id, TOTAL_ATTEMPTS)
  const started = await startSlice(base, run.id)
  const detail = `run ${run.id} had no progress for ${Math.round(idle / 60e3)} min; ${requeued} failed jobs back in the queue; ${started.detail}`
  await updateRun(run.id, { note: appendNote(run.note, `resumed by the watchdog at ${new Date(now).toISOString().slice(11, 16)} UTC: ${started.detail}`) })
  return { action: started.ok ? 'resumed' : 'resume-failed', run: run.id, detail }
}

/** The run, read again (one retry after a short pause, so a single failed read does not end a slice chain). null = no such
 * run, or the store did not answer twice. */
export async function getRunWithRetry(id: number): Promise<PriceRun | null> {
  const first = await getRun(id)
  if (first) return first
  await sleep(2000)
  return getRun(id)
}

export function appendNote(note: string | null, line: string): string {
  return [note, line].filter(Boolean).join('; ').slice(-1500)
}
