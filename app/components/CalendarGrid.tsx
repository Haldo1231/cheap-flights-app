'use client'

import { ALL_WEEKDAYS, dayOfWeek } from '../weekdays'
import type { CalendarDay, CalendarDayMap } from '../tripTypes'
import { formatDay, formatMonth } from '../lib/format'

function daysInMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function firstWeekday(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).getDay()
}

type Props = {
  title: string
  data: CalendarDayMap
  month: string
  onPrev: () => void
  onNext: () => void
  selectedDate: string | undefined
  onSelectDay: (date: string, day: CalendarDay) => void
  allowedDays?: number[]
  /** Earliest / latest month the arrows may reach (YYYY-MM). */
  minMonth?: string
  maxMonth?: string
}

/** One month of cheapest-fare-per-day. Days outside the chosen weekdays, or
 * without a cached price, are visibly disabled and cannot be picked. */
export default function CalendarGrid({
  title,
  data,
  month,
  onPrev,
  onNext,
  selectedDate,
  onSelectDay,
  allowedDays = ALL_WEEKDAYS,
  minMonth,
  maxMonth,
}: Props) {
  const total = daysInMonth(month)
  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday(month); i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)

  // Only allowed-weekday entries count toward the average/cheapest coloring,
  // so a filter to e.g. "Thursdays only" compares Thursdays against each
  // other, not against the whole month.
  const allowedEntries = Object.entries(data).filter(([date]) => allowedDays.includes(dayOfWeek(date)))
  const prices = allowedEntries.map(([, v]) => v.price)
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
  const minPrice = prices.length ? Math.min(...prices) : null

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={!!minMonth && month <= minMonth}
          aria-label={`Previous month, ${title}`}
          className="min-h-10 min-w-10 rounded-sm border border-line bg-white text-sm hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line"
        >
          ←
        </button>
        <h3 className="text-sm font-semibold text-ink">
          {title} · {formatMonth(month)}
        </h3>
        <button
          type="button"
          onClick={onNext}
          disabled={!!maxMonth && month >= maxMonth}
          aria-label={`Next month, ${title}`}
          className="min-h-10 min-w-10 rounded-sm border border-line bg-white text-sm hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line"
        >
          →
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-slate" aria-hidden="true">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />
          const dateStr = `${month}-${String(day).padStart(2, '0')}`
          const entry = data[dateStr]
          const isAllowedDay = allowedDays.includes(dayOfWeek(dateStr))
          const usable = !!entry && isAllowedDay
          const isCheapest = usable && entry.price === minPrice
          const isSelected = selectedDate === dateStr
          const isGood = usable && avg !== null && entry.price < avg
          const airline = entry?.airlineName || entry?.airlineCode
          // Read out by screen readers in addition to the visible day number and price.
          const spoken = !isAllowedDay
            ? `${formatDay(dateStr)}, not one of your selected weekdays.`
            : entry
            ? `${formatDay(dateStr)}${entry.time ? `, departs ${entry.time}` : ''}${airline ? `, ${airline}` : ''}.`
            : `${formatDay(dateStr)}, no cached price.`
          const detail = entry ? `${formatDay(dateStr)} · €${entry.price}${entry.time ? ` · ${entry.time}` : ''}${airline ? ` · ${airline}` : ''}` : undefined

          return (
            <button
              key={i}
              type="button"
              disabled={!usable}
              aria-pressed={usable ? isSelected : undefined}
              onClick={() => usable && onSelectDay(dateStr, entry)}
              title={!isAllowedDay ? 'Not one of your selected weekdays' : usable ? detail : undefined}
              className={`flex aspect-square min-h-11 flex-col items-center justify-center rounded-sm border text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink ${
                !isAllowedDay
                  ? 'cursor-not-allowed border-transparent bg-sand text-faint line-through opacity-60'
                  : isSelected
                  ? 'border-ink bg-amber-soft ring-2 ring-ink'
                  : entry
                  ? isGood
                    ? 'border-ok-line bg-ok-bg hover:border-ink'
                    : 'border-danger-line bg-danger-bg hover:border-ink'
                  : 'cursor-default border-transparent bg-paper text-faint'
              } ${isCheapest && !isSelected ? 'outline outline-2 outline-amber' : ''}`}
            >
              <span className="sr-only">{spoken}</span>
              <span>{day}</span>
              {usable && <span className="font-mono tabular-nums">€{entry.price}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
