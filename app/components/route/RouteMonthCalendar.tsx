import { formatMonth } from '../../lib/format'
import { dayOfWeek } from '../../weekdays'

const HEADS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** Monday-first offset of the 1st of the month. */
function firstOffset(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return (new Date(y, m - 1, 1).getDay() + 6) % 7
}

/** A read-only month of cheapest prices per departure day: no clicking, no JavaScript. The interactive calendars
 * (CalendarGrid) belong to the search; a route page only shows what the store knows, and the cheapest day is marked.
 * A day with no stored price is shown empty rather than guessed at. */
export default function RouteMonthCalendar({ month, prices, today, caption }: { month: string; prices: Record<string, number>; today: string; caption: string }) {
  const total = daysInMonth(month)
  const cells: (string | null)[] = Array(firstOffset(month)).fill(null)
  for (let d = 1; d <= total; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)

  const known = Object.entries(prices).filter(([date]) => date.startsWith(month) && date >= today)
  if (known.length === 0) return null
  const lowest = Math.min(...known.map(([, p]) => p))

  return (
    <figure className="surface p-3 sm:p-4">
      <figcaption className="mb-3">
        <span className="font-mono text-sm font-medium text-ink">{formatMonth(month)}</span>
        <span className="ml-2 text-xs text-slate">{caption}</span>
      </figcaption>
      <div aria-hidden="true" className="mb-1 grid grid-cols-7 gap-1 text-center font-mono text-[10px] uppercase tracking-wider text-faint">
        {HEADS.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <li key={`pad-${i}`} aria-hidden="true" />
          const day = Number(date.slice(8))
          const price = prices[date]
          const past = date < today
          const isLowest = price !== undefined && price === lowest && !past
          const weekend = dayOfWeek(date) === 0 || dayOfWeek(date) === 6
          return (
            <li
              key={date}
              className={`rounded-sm border px-1 py-1.5 text-center ${
                isLowest ? 'border-amber bg-amber/15' : price !== undefined && !past ? 'border-line bg-paper' : 'border-transparent'
              }`}
            >
              <span className={`block font-mono text-[10px] ${weekend && !past ? 'text-amber-ink' : 'text-faint'}`}>{day}</span>
              {price !== undefined && !past ? (
                <span className={`block font-mono text-xs ${isLowest ? 'font-semibold text-ink' : 'text-ink'}`}>
                  <span className="sr-only">{`${day} ${formatMonth(month)}: from `}</span>€{price}
                  {isLowest && <span className="sr-only"> (the cheapest day of this month)</span>}
                </span>
              ) : (
                <span className="block font-mono text-xs text-faint" aria-hidden="true">
                  ·
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
