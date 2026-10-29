import type { AnywhereCity, Leg } from '../tripTypes'
import FlightLeg from './FlightLeg'
import PriceAge from './PriceAge'
import DrillLink from './DrillLink'
import BudgetBadge from './BudgetBadge'
import type { TripEstimate } from '../lib/budget'

type Props = {
  city: AnywhereCity
  /** Where this city opens (its flights screen). */
  href: string
  /** Emphasize the row (the city that decided the country's price). */
  highlight?: boolean
  /** Budget estimate for this city's trip (flight + stay). Only set when a budget is. */
  estimate?: TripEstimate | null
}

function legPrice(leg: Leg & { price?: number | null }) {
  return leg.price ?? null
}

/** One city inside an Anywhere country: its trip (when it was checked against
 * the filters) or, otherwise, one real cached example fare marked as unfiltered. */
export default function AnywhereCityRow({ city, href, highlight = false, estimate = null }: Props) {
  const trip = city.trip
  const example = city.example

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
                {trip.inbound ? (trip.kind === 'fare' ? 'round trip, both flights' : 'out + back') : 'one way'}
              </p>
              <p className="text-[11px]">
                <PriceAge foundAt={trip.foundAt} />
              </p>
              {estimate?.total != null && <p className="mt-0.5 font-mono text-xs font-semibold text-ink">~€{estimate.total} total</p>}
            </>
          ) : (
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

      {!trip && example && (
        <div className="mt-2 border-t border-line pt-1">
          <p className="mt-1 text-xs text-slate">
            Example of a cached fare (dates not filtered): €{example.price} · <PriceAge foundAt={example.foundAt} />
          </p>
          <FlightLeg compact label="Out" leg={example.outbound} />
          {example.inbound && <FlightLeg compact label="Back" leg={example.inbound} />}
        </div>
      )}
    </DrillLink>
  )
}
