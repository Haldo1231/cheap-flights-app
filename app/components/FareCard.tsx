import type { Fare } from '../tripTypes'
import { formatNights, nightsBetweenDates } from '../lib/format'
import FlightLeg from './FlightLeg'

type Props = {
  fare: Fare
  isCheapest?: boolean
  isSelected?: boolean
  onSelect?: () => void
  /** Link to the full trip detail view, when there is one. */
  detailsHref?: string
}

/** One cached fare. A round-trip fare shows BOTH flights; its single price
 * covers them together, which the card says plainly. */
export default function FareCard({ fare, isCheapest = false, isSelected = false, onSelect, detailsHref }: Props) {
  const isRoundTrip = fare.kind === 'round-trip' && fare.inbound
  const nights = fare.inbound ? nightsBetweenDates(fare.outbound.date, fare.inbound.date) : 0
  // Nothing about the flights themselves is known: say it once for the whole fare.
  const detailsUnknown = [fare.outbound, fare.inbound].every(
    (leg) => !leg || (!leg.time && !leg.airlineName && !leg.airlineCode)
  )

  const body = (
    <div className="px-4 pt-4 pb-1 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {isCheapest && (
            <span className="rounded-sm bg-[#FCA311] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-[#14213D]">
              Cheapest
            </span>
          )}
          <span className="rounded-sm border border-[#E5E1D8] bg-[#FBF9F4] px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-[#5B6472]">
            {isRoundTrip ? `Round trip · ${formatNights(nights)}` : 'One way'}
          </span>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-semibold tabular-nums text-[#14213D]">€{fare.price}</p>
          <p className="text-xs text-[#5B6472]">{isRoundTrip ? 'both flights' : 'per person'}</p>
        </div>
      </div>

      <div className="mt-2 divide-y divide-[#E5E1D8]">
        <FlightLeg label="Outbound" leg={fare.outbound} hideMissing={detailsUnknown} />
        {fare.inbound && <FlightLeg label="Return" leg={fare.inbound} hideMissing={detailsUnknown} />}
      </div>
      {detailsUnknown && (
        <p className="mt-1 text-xs text-[#5B6472]">
          Airline and departure times are not in the cached data for this fare — you will see them on the booking site.
        </p>
      )}

      {isRoundTrip && (
        <p className="mt-1 pb-2 text-xs text-[#5B6472]">
          One cached round-trip price for both flights — it is not split per flight.
          {fare.gate ? ` Found via ${fare.gate}.` : ''}
          {fare.returnMatchesRequest === false ? ' Return date differs from the one you asked for.' : ''}
        </p>
      )}
    </div>
  )

  return (
    <li
      className={`rounded-sm border bg-white transition-colors ${
        isSelected ? 'border-2 border-[#FCA311] bg-[#FFF8EC]' : 'border-[#E5E1D8]'
      }`}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={isSelected}
          className="block w-full text-left hover:bg-[#FBF9F4]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14213D]"
        >
          {body}
        </button>
      ) : (
        body
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-4 pt-1 sm:px-5">
        <a
          href={fare.bookingUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-block rounded-sm bg-[#FCA311] px-4 py-2 text-sm font-semibold text-[#14213D] transition-colors hover:bg-[#e8940a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14213D]"
        >
          {isRoundTrip ? 'Book round trip →' : 'Book on Aviasales →'}
        </a>
        {fare.inbound && (
          <a
            href={fare.inbound.bookingUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="text-xs font-medium text-[#14213D] underline decoration-[#FCA311] decoration-2 underline-offset-2 hover:text-[#8a5a00]"
          >
            Return flight only (one-way search)
          </a>
        )}
        {detailsHref && (
          <a
            href={detailsHref}
            className="text-xs font-medium text-[#14213D] underline decoration-[#E5E1D8] decoration-2 underline-offset-2 hover:decoration-[#FCA311]"
          >
            Trip details
          </a>
        )}
      </div>
    </li>
  )
}
