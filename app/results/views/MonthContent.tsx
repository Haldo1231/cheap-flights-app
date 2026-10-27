'use client'

import { useState } from 'react'
import CalendarGrid from '../../components/CalendarGrid'
import DayFlightRow from '../../components/DayFlightRow'
import Drawer from '../../components/Drawer'
import FlightLeg from '../../components/FlightLeg'
import WeekdayFilterPanel from '../../components/WeekdayFilterPanel'
import { CalendarSkeleton, FareListSkeleton } from '../../components/Skeleton'
import { calendarDayToFare } from '../../lib/trip'
import { formatDay, formatMonth, formatNights, shiftMonth } from '../../lib/format'
import type { Fare } from '../../tripTypes'
import type { ResultsParams } from '../useResultsParams'
import type { MonthTrip } from './useMonthTrip'

type Combo = MonthTrip['bestCombinations'][number]

export default function MonthContent({ p, m }: { p: ResultsParams; m: MonthTrip }) {
  const [drawer, setDrawer] = useState<'out' | 'back' | null>(null)
  const { destination, oneWay, departMonth, returnMonth } = p

  const loading = m.calOut.loading || m.calBack.loading
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

  const drawerFares = drawer === 'out' ? m.outFares : m.backFares
  const drawerSelected = drawer === 'out' ? m.selectedOutFare : m.selectedBackFare
  const drawerDate = drawer === 'out' ? m.outDate : m.backDate
  const drawerLoading = drawer === 'out' ? m.outLoading : m.backLoading

  return (
    <div>
      <WeekdayFilterPanel
        outDays={p.outDays}
        backDays={p.backDays}
        oneWay={oneWay}
        minNights={p.minNights}
        maxNights={p.maxNights}
        onToggleOutDay={p.toggleOutDay}
        onToggleBackDay={p.toggleBackDay}
        onChangeMinNights={(v) => p.setParams({ minNights: v })}
        onChangeMaxNights={(v) => p.setParams({ maxNights: v })}
      />

      {failed && (
        <div role="alert" className="mb-6 rounded-sm border border-[#F3B3AC] bg-[#FDECEA] px-5 py-4 text-sm text-[#14213D]">
          Something went wrong loading the calendar. Reload the page to try again.
        </div>
      )}

      {!oneWay && (
        <section className="mb-6" aria-labelledby="best-combos">
          <h2 id="best-combos" className="mb-2 text-sm font-semibold">
            Best combinations
          </h2>
          {loading && <FareListSkeleton count={2} label="Finding the best day pairs" />}
          {!loading && m.bestCombinations.length === 0 && (
            <p className="rounded-sm border border-[#E5E1D8] bg-white px-4 py-3 text-sm text-[#5B6472]">
              {Object.keys(m.outboundData).length > 0 && Object.keys(m.inboundData).length > 0
                ? 'No pair of days fits your weekday and nights filters in these months. A trip needs a cached price on both the outbound and the return day. Loosen the filters, or browse other months with the arrows below.'
                : `No complete round trip to suggest: ${
                    Object.keys(m.outboundData).length === 0
                      ? `no cached outbound prices in ${formatMonth(departMonth)}`
                      : `no cached return prices in ${formatMonth(returnMonth)}`
                  }.`}
            </p>
          )}
          {!loading && m.bestCombinations.length > 0 && (
            <ul className="space-y-2">
              {m.bestCombinations.map((combo, i) => {
                const outLeg = calendarDayToFare(combo.out, combo.outDate, combo.out.origin, destination).outbound
                const backLeg = calendarDayToFare(combo.back, combo.backDate, destination, combo.back.origin).outbound
                const picked = m.outDate === combo.outDate && m.backDate === combo.backDate
                return (
                  <li key={`${combo.outDate}-${combo.backDate}`}>
                    <button
                      type="button"
                      onClick={() => pickCombo(combo)}
                      aria-pressed={picked}
                      className={`flex w-full items-start justify-between gap-3 rounded-sm border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14213D] ${
                        picked ? 'border-2 border-[#14213D] bg-[#FFF8EC]' : 'border-[#E5E1D8] bg-white hover:bg-[#FBF9F4]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {i === 0 && (
                            <span className="rounded-sm bg-[#FCA311] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide">
                              Cheapest
                            </span>
                          )}
                          <span className="font-mono text-xs text-[#5B6472]">{formatNights(combo.nights)}</span>
                        </div>
                        <FlightLeg compact label="Out" leg={outLeg} price={combo.outPrice} />
                        <FlightLeg compact label="Back" leg={backLeg} price={combo.backPrice} />
                      </div>
                      <p className="whitespace-nowrap font-mono text-lg font-semibold tabular-nums">€{combo.total}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <p className="mb-3 text-sm text-[#5B6472]">
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
            />
          )}
        </div>
      )}

      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5B6472]" aria-label="Calendar colours">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-[#A5D6A7] bg-[#E8F5E9]" /> Below average
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-[#F3B3AC] bg-[#FDECEA]" /> Above average
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border-2 border-[#FCA311]" /> Cheapest day
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-[#F1EEE6]" /> Not one of your weekdays / no price
        </li>
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
          <p className="text-sm text-[#5B6472]">
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
            <p className="pt-2 text-xs text-[#5B6472]">
              Choose a flight to use it in your trip. Cached prices can change on the booking site.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  )
}
