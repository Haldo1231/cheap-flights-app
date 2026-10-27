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
          aria-label={`Previous month, ${title}`}
          className="min-h-10 min-w-10 rounded-sm border border-[#E5E1D8] bg-white text-sm hover:border-[#14213D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14213D]"
        >
          ←
        </button>
        <h3 className="text-sm font-semibold text-[#14213D]">
          {title} · {formatMonth(month)}
        </h3>
        <button
          type="button"
          onClick={onNext}
          aria-label={`Next month, ${title}`}
          className="min-h-10 min-w-10 rounded-sm border border-[#E5E1D8] bg-white text-sm hover:border-[#14213D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14213D]"
        >
          →
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-[#5B6472]" aria-hidden="true">
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
          const detail = entry
            ? `${formatDay(dateStr)}, €${entry.price}${entry.time ? `, departs ${entry.time}` : ''}${airline ? `, ${airline}` : ''}`
            : `${formatDay(dateStr)}, no cached price`

          return (
            <button
              key={i}
              type="button"
              disabled={!usable}
              aria-pressed={usable ? isSelected : undefined}
              aria-label={!isAllowedDay ? `${formatDay(dateStr)}, not one of your selected weekdays` : detail}
              onClick={() => usable && onSelectDay(dateStr, entry)}
              title={!isAllowedDay ? 'Not one of your selected weekdays' : usable ? detail : undefined}
              className={`flex aspect-square min-h-11 flex-col items-center justify-center rounded-sm border text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#14213D] ${
                !isAllowedDay
                  ? 'cursor-not-allowed border-transparent bg-[#F1EEE6] text-[#b8b2a3] line-through opacity-60'
                  : isSelected
                  ? 'border-[#14213D] bg-[#FFF8EC] ring-2 ring-[#14213D]'
                  : entry
                  ? isGood
                    ? 'border-[#A5D6A7] bg-[#E8F5E9] hover:border-[#14213D]'
                    : 'border-[#F3B3AC] bg-[#FDECEA] hover:border-[#14213D]'
                  : 'cursor-default border-transparent bg-[#FBF9F4] text-[#c9c3b6]'
              } ${isCheapest && !isSelected ? 'outline outline-2 outline-[#FCA311]' : ''}`}
            >
              <span>{day}</span>
              {usable && <span className="font-mono tabular-nums">€{entry.price}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
