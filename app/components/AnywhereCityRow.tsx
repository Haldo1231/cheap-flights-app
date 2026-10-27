import type { AnywhereCity, Leg } from '../tripTypes'
import FlightLeg from './FlightLeg'

type Props = {
  city: AnywhereCity
  onOpen: () => void
  /** Emphasize the row (the city that decided the country's price). */
  highlight?: boolean
}

function legWithPrice(leg: Leg & { price?: number | null }) {
  return leg.price ?? null
}

/** One city inside an Anywhere country: its trip (when it was checked against
 * the filters) or, otherwise, one real cached example fare marked as unfiltered. */
export default function AnywhereCityRow({ city, onOpen, highlight = false }: Props) {
  const trip = city.trip
  const example = city.example

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-sm border px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14213D] sm:px-4 ${
        highlight ? 'border-[#FCA311] bg-[#FFF8EC] hover:bg-[#FFF2DB]' : 'border-[#E5E1D8] bg-white hover:bg-[#FBF9F4]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[#14213D]">
            {city.name} <span className="font-mono text-sm font-normal text-[#5B6472]">{city.code}</span>
          </p>
          <p className="text-xs text-[#5B6472]">
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
              <p className="font-mono text-lg font-semibold tabular-nums text-[#14213D]">€{trip.price}</p>
              <p className="text-xs text-[#5B6472]">
                {trip.inbound ? (trip.kind === 'fare' ? 'round trip, both flights' : 'out + back') : 'one way'}
              </p>
            </>
          ) : (
            <p className="font-mono text-base tabular-nums text-[#5B6472]">~€{city.roughPrice}</p>
          )}
        </div>
      </div>

      {trip && (
        <div className="mt-2 divide-y divide-[#E5E1D8] border-t border-[#E5E1D8]">
          <FlightLeg compact label="Out" leg={trip.outbound} price={legWithPrice(trip.outbound)} />
          {trip.inbound && <FlightLeg compact label="Back" leg={trip.inbound} price={legWithPrice(trip.inbound)} />}
        </div>
      )}

      {!trip && example && (
        <div className="mt-2 border-t border-[#E5E1D8] pt-1">
          <p className="mt-1 text-xs text-[#5B6472]">Example of a cached fare (dates not filtered): €{example.price}</p>
          <FlightLeg compact label="Out" leg={example.outbound} />
          {example.inbound && <FlightLeg compact label="Back" leg={example.inbound} />}
        </div>
      )}
    </button>
  )
}
