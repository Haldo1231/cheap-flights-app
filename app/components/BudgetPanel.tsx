'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { BUDGET_CHIPS, LEVELS, LEVEL_KEYS, MAX_BUDGET, type LevelKey } from '../budgetConfig'
import { parseBudget } from '../lib/budget'

type Props = {
  budget: number | null
  level: LevelKey
  onChange: (budget: number | null, level: LevelKey) => void
  /** "Only show trips within budget" switch (results pages). Leave out on the search form. */
  withinOnly?: boolean
  onWithinOnly?: (on: boolean) => void
  /** No card around it (when it already sits inside another box). */
  bare?: boolean
  /** Wait this long after typing before telling the page (ms). The search form needs no wait. */
  delay?: number
}

/** "Max total budget" in euro with quick choices, and the three spending styles. Off by default
 * (empty field). Everything is plain inputs and radio buttons, so keyboard and screen readers work. */
export default function BudgetPanel({ budget, level, onChange, withinOnly = false, onWithinOnly, bare = false, delay = 400 }: Props) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const shown = draft ?? (budget === null ? '' : String(budget))

  function commit(next: number | null) {
    if (timer.current) clearTimeout(timer.current)
    onChange(next, level)
  }

  /** Picking a style also applies a budget that is still being typed (no pending change is lost). */
  function chooseLevel(next: LevelKey) {
    if (timer.current) clearTimeout(timer.current)
    const typed = draft !== null ? parseBudget(draft) : budget
    setDraft(null)
    onChange(typed, next)
  }

  function type(value: string) {
    // Only digits: no minus sign, no decimals, no letters.
    const clean = value.replace(/\D/g, '').slice(0, String(MAX_BUDGET).length)
    setDraft(clean)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(parseBudget(clean), level), delay)
  }

  function chooseChip(value: number | null) {
    setDraft(null)
    commit(value)
  }

  const chip = (active: boolean) =>
    `pill min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
      active ? 'border-ink bg-navy text-white' : 'border-line bg-surface text-ink hover:border-ink'
    }`

  return (
    <div className={bare ? '' : 'surface mb-6 p-4'}>
      <div>
        <label htmlFor={`${id}-budget`} className="mb-1 block text-sm font-semibold text-ink">
          Max total budget (EUR)
        </label>
        <p id={`${id}-hint`} className="mb-2 text-xs text-slate">
          Flights plus what you spend there. Optional: leave it empty for no limit.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate">
              €
            </span>
            <input
              id={`${id}-budget`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 300"
              value={shown}
              aria-describedby={`${id}-hint`}
              onChange={(e) => type(e.target.value)}
              onBlur={() => {
                if (draft !== null) {
                  setDraft(null)
                  commit(parseBudget(draft))
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commit(parseBudget(shown))
                  setDraft(null)
                }
              }}
              className="field w-32 pl-7"
            />
          </div>
          <div role="group" aria-label="Quick budgets" className="flex flex-wrap gap-2">
            {BUDGET_CHIPS.map((amount) => (
              <button key={amount} type="button" aria-pressed={budget === amount} onClick={() => chooseChip(amount)} className={`${chip(budget === amount)} px-3.5`}>
                €{amount}
              </button>
            ))}
            {budget !== null && (
              <button
                type="button"
                onClick={() => chooseChip(null)}
                className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-amber"
              >
                No limit
              </button>
            )}
          </div>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="mb-1 text-sm font-semibold text-ink">Spending style</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {LEVEL_KEYS.map((key) => (
            <label key={key} className="relative flex">
              <input type="radio" name={`${id}-level`} checked={level === key} onChange={() => chooseLevel(key)} className="peer sr-only" />
              <span className="flex min-h-11 w-full flex-col rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-ink peer-checked:border-ink peer-checked:bg-amber-soft peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                <span className="font-semibold text-ink">{LEVELS[key].label}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate" aria-live="polite">
          <span className="font-semibold text-ink">{LEVELS[level].label}:</span> {LEVELS[level].blurb} These are estimates, built from
          the destination&apos;s daily averages.
        </p>
      </fieldset>

      {onWithinOnly && budget !== null && (
        <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={withinOnly} onChange={(e) => onWithinOnly(e.target.checked)} className="mt-1 h-5 w-5 accent-ink" />
          <span>
            Only show trips within budget
            <span className="block text-xs text-slate">Hides trips that cost more than €{budget} in total.</span>
          </span>
        </label>
      )}
    </div>
  )
}
