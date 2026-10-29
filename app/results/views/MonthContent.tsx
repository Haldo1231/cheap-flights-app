'use client'

import { useState } from 'react'
import CalendarGrid from '../../components/CalendarGrid'
import DayFlightRow from '../../components/DayFlightRow'
import Drawer from '../../components/Drawer'
import FlightLeg from '../../components/FlightLeg'
import WeekdayFilterBox from '../WeekdayFilterBox'
import BudgetBox from '../BudgetBox'
import BudgetEmpty from '../BudgetEmpty'
import BudgetBadge from '../../components/BudgetBadge'
import type { DestInfo } from '../../components/CostOfStay'
import { affordableText, levelLabel, type TripEstimate } from '../../lib/budget'
import { useMonthBudget } from './useMonthBudget'
import { CalendarSkeleton, FareListSkeleton } from '../../components/Skeleton'
import { calendarDayToFare } from '../../lib/trip'
import { formatDay, formatMonth, formatNights, shiftMonth } from '../../lib/format'
import { todayString } from '../../lib/searchValidation'
import type { Fare } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'
import type { MonthTrip } from './useMonthTrip'

type Combo = MonthTrip['bestCombinations'][number]

export default function MonthContent({ p, m, info, infoReady }: { p: ResultsParams; m: MonthTrip; info: DestInfo | null; infoReady: boolean }) {
  const [drawer, setDrawer] = useState<'out' | 'back' | null>(null)
  const { destination, oneWay, departMonth, returnMonth } = p

  // Prices only exist for upcoming months, about a year ahead.
  const minMonth = todayString().slice(0, 7)
  const maxMonth = shiftMonth(minMonth, 11)

  const mb = useMonthBudget(p, m, info)
  const { budget, level } = p
  const loading = m.calOut.loading || m.calBack.loading || (budget !== null && !infoReady)
  const place = info?.name ?? destination
  const failed = m.calOut.error || m.calBack.error

  function pickDay(leg: 'out' | 'back', date: string) {
    p.setParams(leg === 'out' ? { out: date, of: null } : { back: date, bf: null })
    setDrawer(leg)
  }

  // Choosing a combination selects exactly the two flights the combination shows
  // (the calendar's cheapest cached fare for each day), not another flight of that day.
  function pickCombo(combo: Combo) {
    const out = calendarDayToFare(combo.out, combo.outDate, combo.out.origin, destination)
    const back = calendarDayToFare(combo.back, combo.backDate, destination, combo.back.origin)
    p.setParams({ out: combo.outDate, back: combo.backDate, of: out.id, bf: back.id })
    setDrawer(null)
  }

  function pickFlight(leg: 'out' | 'back', fare: Fare) {
    p.setParams(leg === 'out' ? { of: fare.id } : { bf: fare.id })
    setDrawer(null)
  }

  // The pairs shown: with a budget, the ranked list (within budget first); otherwise the cheapest flights.
  const listRows: { combo: Combo; estimate: TripEstimate | null }[] = mb
    ? mb.shown.slice(0, 10)
    : m.bestCombinations.map((combo) => ({ combo, estimate: null }))

  const drawerFares = drawer === 'out' ? m.outFares : m.backFares
  const drawerSelected = drawer === 'out' ? m.selectedOutFare : m.selectedBackFare
  const drawerDate = drawer === 'out' ? m.outDate : m.backDate
  const drawerLoading = drawer === 'out' ? m.outLoading : m.backLoading

  return (
    <div>
      <WeekdayFilterBox p={p} />
      <BudgetBox p={p} />

      {failed && (
        <div role="alert" className="mb-6 rounded-sm border border-danger-line bg-danger-bg px-5 py-4 text-sm text-ink">
          Something went wrong loading the calendar. Reload the page to try again.
        </div>
      )}

      {!oneWay && (
        <section className="mb-6" aria-labelledby="best-combos">
          <h2 id="best-combos" className="mb-2 text-base font-semibold">
            Best combinations
          </h2>
          {loading && <FareListSkeleton count={2} label="Finding the best day pairs" />}
          {!loading && mb && mb.rows.length > 0 && (
            <p className="mb-3 text-sm text-slate" aria-live="polite">
              {!mb.dataOk ? (
                <>No cost data for {place}: flight prices only, nothing is counted as within your €{budget} budget.</>
              ) : (
                <>
                  <span className="font-semibold text-ink">
                    {mb.withinCount} of {mb.rows.length}
                  </span>{' '}
                  day pair{mb.rows.length === 1 ? '' : 's'} fit your €{budget} budget ({levelLabel(level)} style, flights plus stay), best first.
                </>
              )}
            </p>
          )}
          {!loading && m.bestCombinations.length === 0 && (
            <p className="rounded-sm border border-line bg-surface px-4 py-3 text-sm text-slate">
              {Object.keys(m.outboundData).length > 0 && Object.keys(m.inboundData).length > 0
                ? 'No pair of days fits your weekday and nights filters in these months. A trip needs a cached price on both the outbound and the return day. Loosen the filters, or browse other months with the arrows below.'
                : `No complete round trip to suggest: ${
                    Object.keys(m.outboundData).length === 0
                      ? `no cached outbound prices in ${formatMonth(departMonth)}`
                      : `no cached return prices in ${formatMonth(returnMonth)}`
                  }.`}
            </p>
          )}
          {!loading && mb && mb.rows.length > 0 && mb.shown.length === 0 && (
            <BudgetEmpty
              p={p}
              cheapestTotal={mb.cheapestTotal}
              ultraHelps={mb.ultraHelps}
              noData={!mb.dataOk}
              noun="day pairs"
            />
          )}
          {!loading && listRows.length > 0 && (
            <ul className="space-y-2">
              {listRows.map(({ combo, estimate }, i) => {
                const outLeg = calendarDayToFare(combo.out, combo.outDate, combo.out.origin, destination).outbound
                const backLeg = calendarDayToFare(combo.back, combo.backDate, destination, combo.back.origin).outbound
                const picked = m.outDate === combo.outDate && m.backDate === combo.backDate
                const hint = estimate ? affordableText(estimate, place, false, budget) : null
                return (
                  <li key={`${combo.outDate}-${combo.backDate}`}>
                    <button
                      type="button"
                      onClick={() => pickCombo(combo)}
                      aria-pressed={picked}
                      className={`flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink motion-reduce:transition-none ${
                        picked ? 'border-ink bg-amber-soft shadow-card ring-1 ring-ink' : 'border-line bg-surface hover:border-ink/40 hover:bg-paper'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {i === 0 && (
                            <span className="rounded-full bg-amber px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-deep">
                              {estimate && estimate.status === 'within' ? 'Best for your budget' : 'Cheapest'}
                            </span>
                          )}
                          <span className="font-mono text-xs text-slate">{formatNights(combo.nights)}</span>
                          {estimate && <BudgetBadge estimate={estimate} />}
                        </div>
                        <FlightLeg compact label="Out" leg={outLeg} price={combo.outPrice} />
                        <FlightLeg compact label="Back" leg={backLeg} price={combo.backPrice} />
                        {estimate && (estimate.total !== null || hint) && (
                          <p className="mt-1 text-xs text-slate">
                            {estimate.total !== null && <span className="font-medium text-ink">≈ €{estimate.total} with {estimate.days} day{estimate.days === 1 ? '' : 's'} of stay</span>}
                            {estimate.total !== null && hint ? ' · ' : ''}
                            {hint}
                          </p>
                        )}
                      </div>
                      <p className={`whitespace-nowrap font-mono text-xl font-semibold tabular-nums ${i === 0 ? 'underline decoration-amber decoration-[3px] underline-offset-[6px]' : ''}`}>€{combo.total}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <p className="mb-3 text-sm text-slate">
        Tap a day to see its flights. Each price is the cheapest cached fare for that day.
      </p>

      {loading ? (
        <CalendarSkeleton />
      ) : (
        <div className="mb-4 flex flex-col gap-6 sm:flex-row">
          <CalendarGrid
            title="Departing"
            data={m.outboundData}
            month={departMonth}
            onPrev={() => p.setParams({ month: shiftMonth(departMonth, -1) })}
            onNext={() => p.setParams({ month: shiftMonth(departMonth, 1) })}
            selectedDate={m.outDate ?? undefined}
            onSelectDay={(date: string) => pickDay('out', date)}
            allowedDays={p.outDays}
            marks={mb?.outMarks}
            minMonth={minMonth}
            maxMonth={maxMonth}
          />
          {!oneWay && (
            <CalendarGrid
              title="Returning"
              data={m.inboundData}
              month={returnMonth}
              onPrev={() => p.setParams({ returnMonth: shiftMonth(returnMonth, -1) })}
              onNext={() => p.setParams({ returnMonth: shiftMonth(returnMonth, 1) })}
              selectedDate={m.backDate ?? undefined}
              onSelectDay={(date: string) => pickDay('back', date)}
              allowedDays={p.backDays}
              marks={mb?.backMarks}
              minMonth={minMonth}
              maxMonth={maxMonth}
            />
          )}
        </div>
      )}

      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate" aria-label="Calendar colours">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-ok-line bg-ok-bg" /> Below average
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-danger-line bg-danger-bg" /> Above average
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border-2 border-amber" /> Cheapest day
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-sand" /> Not one of your weekdays / no price
        </li>
        {mb && mb.dataOk && (
          <>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="font-bold text-ink">✓</span> The whole trip fits your €{budget} budget
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="font-mono text-slate">€12</span> Grey price: over budget
            </li>
          </>
        )}
      </ul>

      <Drawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={`${drawer === 'out' ? 'Outbound' : 'Return'} · ${formatDay(drawerDate)}`}
        subtitle={
          drawer === 'out'
            ? `Cached flights from ${p.originList.join(', ')} to ${destination}`
            : `Cached flights from ${destination} to ${p.originList.join(', ')}`
        }
      >
        {drawerLoading && <FareListSkeleton count={3} label="Loading flights for this day" />}
        {!drawerLoading && drawerFares.length === 0 && (
          <p className="text-sm text-slate">
            No cached flight details found for this day. Pick another day, or check the price on the booking site.
          </p>
        )}
        {!drawerLoading && drawerFares.length > 0 && (
          <div className="space-y-2">
            {drawerFares.map((fare, i) => (
              <DayFlightRow
                key={fare.id}
                fare={fare}
                rank={i}
                isSelected={fare.id === drawerSelected?.id}
                onSelect={() => pickFlight(drawer ?? 'out', fare)}
              />
            ))}
            <p className="pt-2 text-xs text-slate">
              Choose a flight to use it in your trip. Cached prices can change on the booking site.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  )
}
