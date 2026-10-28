import type { AnywhereCity, Leg } from '../tripTypes'
import FlightLeg from './FlightLeg'
import DrillLink from './DrillLink'

type Props = {
  city: AnywhereCity
  /** Where this city opens (its flights screen). */
  href: string
  /** Emphasize the row (the city that decided the country's price). */
  highlight?: boolean
}

function legPrice(leg: Leg & { price?: number | null }) {
  return leg.price ?? null
}

/** One city inside an Anywhere country: its trip (when it was checked against
 * the filters) or, otherwise, one real cached example fare marked as unfiltered. */
export default function AnywhereCityRow({ city, href, highlight = false }: Props) {
  const trip = city.trip
  const example = city.example

  return (
    <DrillLink
      href={href}
      className={`block rounded-lg border px-3 py-3 shadow-card transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink sm:px-4 ${
        highlight ? 'border-amber bg-amber-soft hover:bg-amber-soft-hover' : 'border-line bg-white hover:border-ink/30 hover:bg-paper'
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
            </>
          ) : (
            <p className="font-mono text-base tabular-nums text-slate">~€{city.roughPrice}</p>
          )}
        </div>
      </div>

      {trip && (
        <div className="mt-2 divide-y divide-line border-t border-line">
          <FlightLeg compact label="Out" leg={trip.outbound} price={legPrice(trip.outbound)} />
          {trip.inbound && <FlightLeg compact label="Back" leg={trip.inbound} price={legPrice(trip.inbound)} />}
        </div>
      )}

      {!trip && example && (
        <div className="mt-2 border-t border-line pt-1">
          <p className="mt-1 text-xs text-slate">Example of a cached fare (dates not filtered): €{example.price}</p>
          <FlightLeg compact label="Out" leg={example.outbound} />
          {example.inbound && <FlightLeg compact label="Back" leg={example.inbound} />}
        </div>
      )}
    </DrillLink>
  )
}
