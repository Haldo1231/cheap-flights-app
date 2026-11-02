'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Breadcrumbs from '../components/Breadcrumbs'
import CalendarGrid from '../components/CalendarGrid'
import DayFlightRow from '../components/DayFlightRow'
import Drawer from '../components/Drawer'
import Flag from '../components/Flag'
import FlightLeg from '../components/FlightLeg'
import PriceAge from '../components/PriceAge'
import ScrollTopOnArrive from '../components/ScrollTopOnArrive'
import { CalendarSkeleton, FareListSkeleton } from '../components/Skeleton'
import { airportCity, airportCountryCode } from '../airportsList'
import { buildBookingLink } from '../aviasalesLink'
import { HOME_AIRPORTS } from '../homeAirports'
import { formatDay, formatMonth, shiftMonth } from '../lib/format'
import { returnCalendar, useReturnMonth } from '../lib/returnMonth'
import { snapshotFromLegs } from '../lib/trip'
import { BACK_KEYS, parseTrip, resultsHrefFromTrip, tripHref } from '../lib/tripUrl'
import { todayString } from '../lib/searchValidation'
import { withParams } from '../lib/resultsUrl'
import { useJson } from '../lib/useJson'
import type { Fare, Leg } from '../tripTypes'
import type { ReturnFlightsResponse } from '../api/return-flights/route'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_SPAN_DAYS = 90

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const dateParam = (v: string | null) => (v && DATE.test(v) ? v : null)
const airportName = airportCity
const MONTH = /^\d{4}-\d{2}$/

type Days = { mode: 'exact' | 'range'; start: string; end: string }

/** Which days to look at: from the address, otherwise the two weeks after the outbound flight. */
function readDays(get: (k: string) => string | null, outDate: string): Days {
  const mode = get('bm') === 'exact' ? 'exact' : 'range'
  const start = dateParam(get('bs')) ?? outDate
  const end = mode === 'exact' ? start : dateParam(get('be')) ?? addDays(start, 14)
  return { mode, start, end }
}

/** The form for the return days. Remounted (key) when the address changes so it always shows what is being searched. */
function DaysForm({ days, outDate, onSearch }: { days: Days; outDate: string; onSearch: (next: Days) => void }) {
  const [mode, setMode] = useState(days.mode)
  const [start, setStart] = useState(days.start)
  const [end, setEnd] = useState(days.end)
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const last = mode === 'exact' ? start : end
    if (!DATE.test(start) || (mode === 'range' && !DATE.test(end))) return setError('Pick the day or days you want to fly back.')
    if (start < outDate) return setError(`The flight back can not be before your outbound flight (${formatDay(outDate)}).`)
    if (last < start) return setError('The last day can not be before the first day.')
    if (daysBetween(start, last) > MAX_SPAN_DAYS) return setError(`Pick at most ${MAX_SPAN_DAYS} days at a time.`)
    setError(null)
    onSearch({ mode, start, end: last })
  }

  const pill = (active: boolean) =>
    `pill min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
      active ? 'border-ink bg-navy text-white' : 'border-line bg-surface text-ink hover:border-ink'
    }`

  return (
    <form onSubmit={submit} noValidate className="surface mb-6 p-4" aria-labelledby="back-days-title">
      <h2 id="back-days-title" className="mb-2 text-base font-semibold">
        When do you want to fly back?
      </h2>
      <div role="radiogroup" aria-labelledby="back-days-title" className="mb-3 flex flex-wrap gap-2">
        <button type="button" role="radio" aria-checked={mode === 'range'} onClick={() => setMode('range')} className={pill(mode === 'range')}>
          Date range
        </button>
        <button type="button" role="radio" aria-checked={mode === 'exact'} onClick={() => setMode('exact')} className={pill(mode === 'exact')}>
          Exact date
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="back-start" className="mb-1 block text-sm text-slate">
            {mode === 'exact' ? 'Return date' : 'Fly back from'}
          </label>
          <input id="back-start" type="date" value={start} min={outDate} onChange={(e) => setStart(e.target.value)} className="field" />
        </div>
        {mode === 'range' && (
          <div>
            <label htmlFor="back-end" className="mb-1 block text-sm text-slate">
              Fly back until
            </label>
            <input id="back-end" type="date" value={end} min={start || outDate} onChange={(e) => setEnd(e.target.value)} className="field" />
          </div>
        )}
        <button type="submit" className="btn btn-amber">
          Find flights back
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  )
}

/** The combined trip: outbound + chosen return, the total, and one booking link per flight. `compact` (the phone's bottom bar)
 * shows the total and the buttons first and keeps the flight details behind a fold. */
function CombinedTrip({
  out,
  outPrice,
  back,
  detailsHref,
  compact = false,
}: {
  out: Leg
  outPrice: number
  back: Fare
  detailsHref: string
  compact?: boolean
}) {
  const legs = (
    <div className="divide-y divide-line">
      <FlightLeg compact label="Out" leg={out} price={outPrice} />
      <FlightLeg compact label="Back" leg={back.outbound} price={back.price} />
    </div>
  )
  return (
    <section aria-label="Your trip" className={compact ? '' : 'surface p-4'}>
      {!compact && <p className="mb-1 font-semibold text-ink">Your trip</p>}
      {!compact && legs}
      <div className={`flex items-baseline justify-between gap-3 ${compact ? '' : 'mt-3 border-t-2 border-ink pt-3'}`}>
        <span className="font-semibold text-ink">{compact ? 'Your trip, total' : 'Total, both flights'}</span>
        <span className="font-mono text-2xl font-semibold tabular-nums text-ink">€{outPrice + back.price}</span>
      </div>
      <p className="mt-1 text-xs text-slate">
        Two separate one-way tickets: €{outPrice} + €{back.price}. Cached prices, they can differ on the booking sites.
      </p>
      {compact && (
        <details className="mt-1 text-sm">
          <summary className="inline-flex min-h-9 cursor-pointer items-center font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
            Show flights
          </summary>
          {legs}
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={out.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-amber">
          Book outbound →
        </a>
        <a href={back.outbound.bookingUrl} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-amber">
          Book return →
        </a>
        <Link href={detailsHref} className="btn btn-outline">
          Trip details →
        </Link>
      </div>
    </section>
  )
}

export default function BackClient() {
  const sp = useSearchParams()
  const router = useRouter()
  const trip = parseTrip((k) => sp.get(k))
  const [retry, setRetry] = useState(0)

  const dest = trip?.outbound.destination ?? ''
  const place = useJson<{ city: { name: string } | null }>(dest ? `/api/place?city=${encodeURIComponent(dest)}` : null)
  const cityName = place.data?.city?.name ?? airportName(dest)

  const outDate = trip?.outbound.date ?? ''
  const outOrigin = trip?.outbound.origin ?? ''
  // `bx=1`: not back to the airport the outbound flight left from (the button "Fly back to a different airport").
  const notBackToOrigin = sp.get('bx') === '1'
  const airports = notBackToOrigin ? HOME_AIRPORTS.filter((a) => a !== outOrigin) : HOME_AIRPORTS
  const airportList = airports.join(',')

  // How to look: a month calendar (bm=month), or exact day(s). All of it lives in the address.
  const monthMode = sp.get('bm') === 'month'
  const today = todayString()
  const firstMonth = (outDate || today).slice(0, 7)
  const lastMonth = shiftMonth(today.slice(0, 7), 11)
  const monthParam = sp.get('bmon')
  const month = monthParam && MONTH.test(monthParam) && monthParam >= firstMonth && monthParam <= lastMonth ? monthParam : firstMonth
  const tappedDay = dateParam(sp.get('bday'))
  const selectedDay = tappedDay && tappedDay.startsWith(month) ? tappedDay : null

  const days = trip && !monthMode ? readDays((k) => sp.get(k), outDate) : null
  const url =
    trip && days
      ? `/api/return-flights?${new URLSearchParams({ from: dest, mode: days.mode, ...(days.mode === 'exact' ? { date: days.start } : { start: days.start, end: days.end }), after: outDate, to: airportList })}`
      : null
  const { data, loading, error } = useJson<ReturnFlightsResponse>(url, retry)
  const monthData = useReturnMonth({ enabled: !!trip && !trip.inbound && monthMode, from: dest, airports, month })

  const closeDay = useCallback(() => router.replace(withParams(sp, { bday: null }, '/back'), { scroll: false }), [router, sp])

  if (!trip || trip.inbound) {
    return (
      <div className="surface px-5 py-6">
        <p className="mb-2 font-semibold">Pick a one-way flight first</p>
        <p className="mb-3 text-sm text-slate">&ldquo;Find a flight back&rdquo; starts from a one-way flight. Search for one and use the button on it.</p>
        <Link href="/search" className="text-sm font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
          Go to search →
        </Link>
      </div>
    )
  }

  const outLeg: Leg = {
    origin: trip.outbound.origin,
    destination: trip.outbound.destination,
    date: trip.outbound.date,
    time: trip.outbound.time,
    airlineCode: trip.outbound.airlineCode,
    airlineName: null,
    stops: trip.outbound.stops,
    bookingUrl: buildBookingLink(trip.outbound.origin, trip.outbound.destination, trip.outbound.date),
  }
  const outPrice = trip.outbound.price ?? trip.price
  const fares = data?.results ?? []
  const pickedId = sp.get('pick')
  const monthFares = Object.values(monthData.byDate).flat()
  const picked = (monthMode ? monthFares : fares).find((f) => f.id === pickedId) ?? null
  const calendar = returnCalendar(monthData.byDate, { after: outDate })
  const dayFares = selectedDay ? monthData.byDate[selectedDay] ?? [] : []
  const otherAirports = airports.length === HOME_AIRPORTS.length ? 'BTS, VIE, BUD, KSC or PRG' : `${airports.slice(0, -1).join(', ')} or ${airports[airports.length - 1]}`

  const baseForTrip = new URLSearchParams(sp.toString())
  for (const key of BACK_KEYS) baseForTrip.delete(key)
  const detailsHref = picked
    ? tripHref(baseForTrip, dest, snapshotFromLegs({ ...outLeg, price: outPrice }, { ...picked.outbound, price: picked.price }))
    : ''

  function search(next: Days) {
    router.replace(withParams(sp, { bm: next.mode, bs: next.start, be: next.mode === 'range' ? next.end : null, pick: null }, '/back'), { scroll: false })
  }
  function pick(id: string) {
    router.replace(withParams(sp, { pick: id }, '/back'), { scroll: false })
  }
  /** Between the month calendar and exact days. Whatever was picked is dropped (it belongs to the other view). */
  function showMonth(on: boolean) {
    const changes = on
      ? { bm: 'month', bmon: firstMonth, bs: null, be: null, bday: null, pick: null }
      : { bm: 'range', bmon: null, bday: null, bs: null, be: null, pick: null }
    router.replace(withParams(sp, changes, '/back'), { scroll: false })
  }
  function goToMonth(next: string) {
    router.replace(withParams(sp, { bmon: next, bday: null, pick: null }, '/back'), { scroll: false })
  }
  function tapDay(day: string) {
    router.replace(withParams(sp, { bday: day, pick: null }, '/back'), { scroll: false })
  }

  return (
    <div className="view-in">
      <ScrollTopOnArrive />
      <Breadcrumbs items={[{ label: 'Search', href: '/search' }, { label: cityName, href: resultsHrefFromTrip(sp) }, { label: 'Find a flight back' }]} />
      <h1 className="h-page mb-1">Find a flight back from {cityName}</h1>
      <p className="mb-5 text-sm text-slate">
        {monthMode
          ? `A month of cached one-way flights from ${cityName} to ${otherAirports}. Your outbound flight and the flight back are two separate one-way tickets, so you can come back to a different airport than you left from.`
          : `Cached one-way flights from ${cityName} to any of ${otherAirports}, cheapest first. You can come back to a different airport than you left from.`}
      </p>

      <section aria-label="Your outbound flight" className="surface mb-5 p-4">
        <p className="mb-1 text-sm font-semibold text-ink">Your outbound flight</p>
        <FlightLeg compact label="Out" leg={outLeg} price={outPrice} />
      </section>

      {days && (
        <>
          <DaysForm key={`${days.mode}-${days.start}-${days.end}`} days={days} outDate={outDate} onSearch={search} />
          <p className="-mt-3 mb-6 text-sm">
            <button type="button" onClick={() => showMonth(true)} className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
              Show a month calendar instead
            </button>
          </p>
        </>
      )}


      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          {monthMode && (
            <section aria-labelledby="back-month-title" className="surface max-w-lg p-4">
              <h2 id="back-month-title" className="mb-1 text-base font-semibold">
                Pick a day to fly back
              </h2>
              <p className="mb-3 text-sm text-slate">
                Each day shows the cheapest cached flight back to {otherAirports}, and which airport it is. Tap a day to see all of them, cheapest first.
              </p>
              {monthData.loading ? (
                <CalendarSkeleton label="Loading the flights back" />
              ) : monthData.error ? (
                <div role="alert" className="rounded-sm border border-danger-line bg-danger-bg px-4 py-3 text-sm text-ink">
                  Something went wrong loading this month. Reload the page to try again.
                </div>
              ) : (
                <CalendarGrid
                  title="Flying back"
                  data={calendar.days}
                  notes={calendar.notes}
                  month={month}
                  onPrev={() => goToMonth(shiftMonth(month, -1))}
                  onNext={() => goToMonth(shiftMonth(month, 1))}
                  selectedDate={selectedDay ?? picked?.outbound.date}
                  onSelectDay={tapDay}
                  minMonth={firstMonth}
                  maxMonth={lastMonth}
                />
              )}
              {!monthData.loading && !monthData.error && Object.keys(calendar.days).length === 0 && (
                <p role="status" className="mt-3 rounded-sm border border-line bg-paper px-3 py-2 text-sm text-slate">
                  No cached flights back from {cityName} to {otherAirports} in {formatMonth(month)}. The free price data is a cache, so small routes are often empty: try another month with the arrows.
                </p>
              )}
              <p className="mt-3 text-xs text-slate">
                Days without a price have no cached flight. Prices are cached and can differ on the booking site.{' '}
                <button type="button" onClick={() => showMonth(false)} className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
                  Pick exact days instead
                </button>
              </p>
            </section>
          )}
          {!monthMode && loading && <FareListSkeleton count={4} label="Looking for flights back" />}

          {!monthMode && !loading && error && (
            <div role="alert" className="rounded-sm border border-danger-line bg-danger-bg px-5 py-4">
              <p className="mb-3 text-ink">Something went wrong loading the flights back.</p>
              <button type="button" onClick={() => setRetry((n) => n + 1)} className="btn btn-primary">
                Try again
              </button>
            </div>
          )}

          {!monthMode && !loading && !error && fares.length === 0 && days && (
            <div role="status" className="surface px-5 py-6">
              <p className="mb-2 font-semibold">
                No cached flights back from {cityName} to {otherAirports}{' '}
                {days.mode === 'exact' ? `on ${formatDay(days.start)}` : `from ${formatDay(days.start)} to ${formatDay(days.end)}`}.
              </p>
              <p className="text-sm text-slate">
                The free price data is a cache, so small routes and single days are often empty. Try a wider date range or another day.
              </p>
            </div>
          )}

          {!monthMode && !loading && !error && fares.length > 0 && (
            <>
              <p className="mb-3 text-sm text-slate" aria-live="polite">
                {data && data.total > fares.length ? `The cheapest ${fares.length} of ${data.total} cached flights back` : `${fares.length} cached flight${fares.length === 1 ? '' : 's'} back`}, cheapest first. Pick one to see the trip.
              </p>
              <ul className="space-y-2">
                {fares.map((fare, i) => {
                  const leg = fare.outbound
                  const airline = leg.airlineName || leg.airlineCode
                  const isPicked = fare.id === picked?.id
                  return (
                    <li key={fare.id}>
                      <button
                        type="button"
                        onClick={() => pick(fare.id)}
                        aria-pressed={isPicked}
                        className={`flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-3 text-left transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink motion-reduce:transition-none ${
                          isPicked ? 'border-ink bg-amber-soft shadow-card ring-1 ring-ink' : 'border-line bg-surface hover:border-ink/40 hover:bg-paper'
                        }`}
                      >
                        <div className="min-w-0">
                          {i === 0 && <span className="mb-1 inline-block rounded-full bg-amber px-2 py-px font-mono text-[10px] font-semibold uppercase tracking-wide text-deep">Cheapest</span>}
                          <p className="flex flex-wrap items-center gap-x-2 text-sm">
                            <Flag code={airportCountryCode(leg.destination)} size="xs" />
                            <span className="font-semibold text-ink">
                              To {airportName(leg.destination)} <span className="font-mono text-slate">{leg.destination}</span>
                            </span>
                          </p>
                          <p className="text-sm text-ink">
                            <span className="font-semibold">{formatDay(leg.date)}</span>{' '}
                            {leg.time ? <span className="font-mono font-semibold tabular-nums">{leg.time}</span> : <span className="text-slate">time not in cached data</span>}
                          </p>
                          <p className="text-xs text-slate">
                            {airline ? <span className="font-medium text-ink">{airline}</span> : 'airline not in cached data'}
                            {leg.stops === 0 ? ' · Direct' : leg.stops ? ` · ${leg.stops} stop${leg.stops === 1 ? '' : 's'}` : ''}
                            {' · '}
                            <PriceAge seenAt={fare.seenAt} />
                          </p>
                        </div>
                        <p className="shrink-0 font-mono text-xl font-semibold tabular-nums text-ink">€{fare.price}</p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        {picked && (
          <div className="hidden lg:block lg:w-80 lg:flex-shrink-0">
            <div className="lg:sticky lg:top-6">
              <CombinedTrip out={outLeg} outPrice={outPrice} back={picked} detailsHref={detailsHref} />
            </div>
          </div>
        )}
      </div>

      {picked && <div aria-hidden="true" className="h-56 lg:hidden" />}

      {picked && (
        <div data-back-bar className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto border-t border-line bg-surface p-3 shadow-[0_-4px_12px_rgba(20,33,61,0.10)] lg:hidden">
          <CombinedTrip compact out={outLeg} outPrice={outPrice} back={picked} detailsHref={detailsHref} />
        </div>
      )}

      <Drawer
        open={monthMode && !!selectedDay && !picked}
        onClose={closeDay}
        title={`Flights back · ${formatDay(selectedDay)}`}
        subtitle={`Cached one-way flights from ${cityName} to ${otherAirports}, cheapest first`}
      >
        {dayFares.length === 0 && (
          <p className="text-sm text-slate">No cached flight details found for this day. Pick another day, or check the price on the booking site.</p>
        )}
        {dayFares.length > 0 && (
          <div className="space-y-2">
            {dayFares.map((fare, i) => (
              <DayFlightRow key={fare.id} fare={fare} rank={i} isSelected={fare.id === pickedId} onSelect={() => pick(fare.id)} showDestinationCity />
            ))}
            <p className="pt-2 text-xs text-slate">Choose a flight to see your whole trip with both booking links. Cached prices can change on the booking site.</p>
          </div>
        )}
      </Drawer>
    </div>
  )
}
