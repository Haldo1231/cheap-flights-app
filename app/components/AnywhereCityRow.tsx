import type { AnywhereCity, Leg } from '../tripTypes'
import FlightLeg from './FlightLeg'
import DrillLink from './DrillLink'
import BudgetBadge from './BudgetBadge'
import PriceAge from './PriceAge'
import { vsRoundTrip } from './DifferentAirportLine'
import type { TripEstimate } from '../lib/budget'
import { tripRouteLabel } from '../lib/tripRoute'

type Props = {
  city: AnywhereCity
  /** Where this city opens (its flights screen). */
  href: string
  /** Emphasize the row (the city that decided the country's price). */
  highlight?: boolean
  /** Budget estimate for this city's trip (flight + stay). Only set when a budget is. */
  estimate?: TripEstimate | null
  /** The "fly back to a different airport" switch is on: the trip says what it is ("round trip, back to BTS" / "two
   * one-way tickets, back to PRG"), and a trip back to another airport says what the same-airport round trip costs.
   * Off = the wording stays exactly as it was. */
  routeLabel?: boolean
  /** A one-way search: the rough price of a city with no matching day comes from a cached ticket that may be a round
   * trip, so it is not shown. */
  oneWay?: boolean
}

function legPrice(leg: Leg & { price?: number | null }) {
  return leg.price ?? null
}

/** Under a trip that comes back to another airport: how it compares with the round trip from the same airport. */
function compareNote(price: number, roundTripPrice: number | null): string {
  return roundTripPrice === null
    ? 'No round trip from the same airport on your days to compare with.'
    : `${vsRoundTrip(price - roundTripPrice)} (round trip from the same airport: €${roundTripPrice})`
}

/** One city inside an Anywhere country: its trip when it was checked against the filters. A city with no matching
 * day only shows the rough price (round-trip searches); it never shows a fare that was not checked against the filters. */
export default function AnywhereCityRow({ city, href, highlight = false, estimate = null, routeLabel = false, oneWay = false }: Props) {
  const trip = city.trip
  const note = trip && routeLabel && city.roundTripPrice !== undefined ? compareNote(trip.price, city.roundTripPrice) : null

  return (
    <DrillLink
      href={href}
      className={`block rounded-lg border px-3 py-3 shadow-card transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink sm:px-4 ${
        highlight ? 'border-amber bg-amber-soft hover:bg-amber-soft-hover' : 'border-line bg-surface hover:border-ink/30 hover:bg-paper'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            {city.name} <span className="font-mono text-sm font-normal text-slate">{city.code}</span>
          </p>
          <p className="text-xs text-slate">
            from {city.origin} ·{' '}
            {trip
              ? 'matches your filters'
              : trip === null
              ? 'no day matches your filters'
              : 'not checked against your filters yet'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {trip ? (
            <>
              <p className={`font-mono text-lg font-semibold tabular-nums text-ink ${highlight ? 'underline decoration-amber decoration-[3px] underline-offset-[6px]' : ''}`}>€{trip.price}</p>
              <p className="text-xs text-slate">
                {routeLabel ? tripRouteLabel(trip) : trip.inbound ? (trip.kind === 'fare' ? 'round trip, both flights' : 'out + back') : 'one way'}
              </p>
              {estimate?.total != null && <p className="mt-0.5 font-mono text-xs font-semibold text-ink">~€{estimate.total} total</p>}
              <p className="text-xs text-slate first-letter:uppercase">
                <PriceAge seenAt={trip.seenAt} />
              </p>
            </>
          ) : oneWay ? null : (
            <p className="font-mono text-base tabular-nums text-slate">~€{city.roughPrice}</p>
          )}
        </div>
      </div>

      {trip && estimate && estimate.status !== 'none' && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-2 text-xs text-slate">
          <BudgetBadge estimate={estimate} />
          {estimate.total !== null && <span>flight + {estimate.days} day{estimate.days === 1 ? '' : 's'} of stay, estimate</span>}
        </p>
      )}

      {trip && (
        <div className="mt-2 divide-y divide-line border-t border-line">
          <FlightLeg compact label="Out" leg={trip.outbound} price={legPrice(trip.outbound)} />
          {trip.inbound && <FlightLeg compact label="Back" leg={trip.inbound} price={legPrice(trip.inbound)} />}
        </div>
      )}

      {trip && note && <p className="mt-1 border-t border-line pt-2 text-xs font-medium text-ink">{note}</p>}
    </DrillLink>
  )
}
