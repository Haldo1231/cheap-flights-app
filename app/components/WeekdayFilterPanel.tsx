'use client'

import { WEEKDAY_BUTTONS } from '../weekdays'

type Props = {
  outDays: number[]
  backDays: number[]
  oneWay: boolean
  minNights: number
  maxNights: number
  onToggleOutDay: (day: number) => void
  onToggleBackDay: (day: number) => void
  onChangeMinNights: (value: string) => void
  onChangeMaxNights: (value: string) => void
  /** No card around it (when it already sits inside another box). */
  bare?: boolean
}

function DayToggles({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: number[]
  onToggle: (day: number) => void
}) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-2 text-sm font-semibold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {WEEKDAY_BUTTONS.map((d) => {
          const on = selected.includes(d.value)
          return (
            <button
              key={d.value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(d.value)}
              className={`pill min-w-12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                on
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white text-slate hover:border-ink hover:text-ink'
              }`}
            >
              {on && (
                <span aria-hidden="true" className="text-xs">
                  ✓
                </span>
              )}
              {d.label}
            </button>
          )
        })}
      </div>
    </fieldset>
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field w-24"
      />
    </div>
  )
}

/** Mon-Sun departure/return day toggles + min/max nights. Used by the Whole
 * Month calendar and by the Anywhere search, so the filters look and mean the
 * same in both places. */
export default function WeekdayFilterPanel({
  outDays,
  backDays,
  oneWay,
  minNights,
  maxNights,
  onToggleOutDay,
  onToggleBackDay,
  onChangeMinNights,
  onChangeMaxNights,
  bare = false,
}: Props) {
  return (
    <div className={bare ? '' : 'surface mb-6 p-4'}>
      <DayToggles label="Departure days" selected={outDays} onToggle={onToggleOutDay} />
      {!oneWay && (
        <>
          <DayToggles label="Return days" selected={backDays} onToggle={onToggleBackDay} />
          <div className="flex flex-wrap items-end gap-3">
            <NightsInput id="min-nights" label="Min nights" value={minNights} onChange={onChangeMinNights} />
            <NightsInput id="max-nights" label="Max nights" value={maxNights} onChange={onChangeMaxNights} />
          </div>
        </>
      )}
    </div>
  )
}
