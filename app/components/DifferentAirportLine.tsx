import PriceAge from './PriceAge'

/** How a different-airport trip compares with the cheapest round trip from the same airport:
 * "+€8 vs round trip", "−€5 vs round trip", or "same price as the round trip". */
export function vsRoundTrip(difference: number): string {
  if (difference > 0) return `+€${difference} vs round trip`
  if (difference < 0) return `−€${-difference} vs round trip`
  return 'same price as the round trip'
}

type Props = {
  /** The home airport the trip leaves from, the city, and the (different) home airport it comes back to. */
  from: string
  place: string
  to: string
  /** The two one-way tickets added together. */
  price: number
  /** price minus the cheapest same-airport round trip; null when there is no round trip to compare with. */
  difference: number | null
  /** When a traveller saw the price (the older of the two), if the data says. */
  seenAt?: string | null
  className?: string
}

/** The extra line next to a round-trip price: the cheapest trip that comes back to another home airport, e.g.
 * "BTS → Barcelona → PRG, €68 (+€8 vs round trip)". The main price stays the round trip; this never replaces it. */
export default function DifferentAirportLine({ from, place, to, price, difference, seenAt, className = '' }: Props) {
  return (
    <p className={className} data-different-airport-line>
      <span className="font-semibold text-ink">
        {from} → {place} → {to}, €{price}
      </span>
      {difference !== null && <span className="font-medium text-ink"> ({vsRoundTrip(difference)})</span>}
      <span className="block text-xs text-slate">
        Back to a different airport · two one-way tickets{seenAt !== undefined && <> · <PriceAge seenAt={seenAt} /></>}
      </span>
    </p>
  )
}
