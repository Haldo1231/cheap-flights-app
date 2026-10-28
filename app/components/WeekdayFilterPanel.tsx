'use client'

import { useId, useState } from 'react'
import { ALL_WEEKDAYS, WEEKDAY_BUTTONS } from '../weekdays'

type Props = {
  /** The days that count right now: all seven when there is no restriction. */
  outDays: number[]
  backDays: number[]
  oneWay: boolean
  minNights: number
  maxNights: number
  /** Called with the new list of allowed days (all seven = no restriction). */
  onChangeOutDays: (days: number[]) => void
  onChangeBackDays: (days: number[]) => void
  onChangeMinNights: (value: string) => void
  onChangeMaxNights: (value: string) => void
  /** No card around it (when it already sits inside another box). */
  bare?: boolean
}

const WEEKENDS = [6, 0]
const WORKDAYS = [1, 2, 3, 4, 5]

function sameDays(a: number[], b: number[]) {
  return a.length === b.length && a.every((d) => b.includes(d))
}

function dayNames(days: number[]) {
  return WEEKDAY_BUTTONS.filter((d) => days.includes(d.value))
    .map((d) => d.label)
    .join(', ')
}

/** An on/off switch (a button, so keyboard and screen readers work). */
function Switch({ checked, onChange, label, controls }: { checked: boolean; onChange: () => void; label: string; controls: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-controls={controls}
      onClick={onChange}
      className="group -mr-1 inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-full px-1 text-sm font-medium text-ink"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 rounded-full transition-colors duration-200 motion-reduce:transition-none ${checked ? 'bg-amber' : 'bg-faint'}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  )
}

/** One day question ("Departure days" or "Return days"). Off by default: any day works.
 * Turned on, it shows Mon to Sun and quick choices, and starts with NOTHING picked so
 * choosing just Thursday is one tap. */
function DaySection({ label, days, onChange }: { label: string; days: number[]; onChange: (days: number[]) => void }) {
  const chipsId = useId()
  const restricted = days.length < ALL_WEEKDAYS.length
  const [local, setLocal] = useState<{ on: boolean; picked: number[] }>({ on: false, picked: [] })
  // A restriction that comes from the address (a shared link, the Back button) always shows.
  const on = local.on || restricted
  const picked = restricted ? days : local.picked

  /** Nothing picked, or all seven, means "any day": no restriction in the address. */
  function commit(next: number[]) {
    setLocal({ on: true, picked: next })
    onChange(next.length === 0 || next.length === ALL_WEEKDAYS.length ? ALL_WEEKDAYS : next)
  }

  function toggleSwitch() {
    if (on) {
      setLocal({ on: false, picked: [] })
      onChange(ALL_WEEKDAYS)
    } else {
      setLocal({ on: true, picked: [] })
    }
  }

  const pill = (active: boolean) =>
    `pill min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
      active ? 'border-ink bg-navy text-white' : 'border-line bg-surface text-slate hover:border-ink hover:text-ink'
    }`

  return (
    <div className="mb-3 rounded-lg border border-line bg-paper/60 px-3 pb-3 pt-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="truncate text-xs text-slate">{on && picked.length > 0 ? dayNames(picked) : 'Any day works'}</p>
        </div>
        <Switch checked={on} onChange={toggleSwitch} label="Only specific days" controls={chipsId} />
      </div>

      <div id={chipsId} hidden={!on}>
        {on && (
          <div className="pt-2">
            <div role="group" aria-label={label} className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_BUTTONS.map((d) => {
                const active = picked.includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => commit(active ? picked.filter((x) => x !== d.value) : [...picked, d.value])}
                    className={`${pill(active)} px-0`}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" aria-pressed={sameDays(picked, WEEKENDS)} onClick={() => commit(WEEKENDS)} className={`${pill(sameDays(picked, WEEKENDS))} px-3.5`}>
                Weekends
              </button>
              <button type="button" aria-pressed={sameDays(picked, WORKDAYS)} onClick={() => commit(WORKDAYS)} className={`${pill(sameDays(picked, WORKDAYS))} px-3.5`}>
                Weekdays
              </button>
              <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
              <button
                type="button"
                onClick={() => commit(ALL_WEEKDAYS)}
                className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-ink underline decoration-amber decoration-2 underline-offset-4"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => commit([])}
                className="inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-amber"
              >
                Clear
              </button>
            </div>
            {picked.length === 0 && <p className="mt-1 text-xs text-slate">Tap the days you can fly. With none picked, any day counts.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function NightsInput({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-slate">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={60}
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        className="field w-24"
      />
    </div>
  )
}

/** Which weekdays to leave and come back on (any day by default), and how many nights.
 * Used by the Whole Month calendar and by the Anywhere search, so the filters look and
 * mean the same in both places. */
export default function WeekdayFilterPanel({
  outDays,
  backDays,
  oneWay,
  minNights,
  maxNights,
  onChangeOutDays,
  onChangeBackDays,
  onChangeMinNights,
  onChangeMaxNights,
  bare = false,
}: Props) {
  return (
    <div className={bare ? '' : 'surface mb-6 p-4'}>
      <DaySection label="Departure days" days={outDays} onChange={onChangeOutDays} />
      {!oneWay && (
        <>
          <DaySection label="Return days" days={backDays} onChange={onChangeBackDays} />
          <div className="flex flex-wrap items-end gap-3">
            <NightsInput id="min-nights" label="Min nights" value={minNights} onChange={onChangeMinNights} />
            <NightsInput id="max-nights" label="Max nights" value={maxNights} onChange={onChangeMaxNights} />
          </div>
        </>
      )}
    </div>
  )
}
