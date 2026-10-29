import type { Trip } from '../../lib/content/schema'
import { tripCosts } from '../../lib/content/costs'
import { AIRPORTS } from '../../airportsList'

function Row({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${strong ? 'font-semibold text-ink' : 'text-slate'}`}>
      <dt>{label}</dt>
      <dd className="text-right font-mono tabular-nums text-ink">{value}</dd>
    </div>
  )
}

/** The facts of the trip in one box: who, where from, and what it really cost per person. */
export default function TripFacts({ trip }: { trip: Trip }) {
  const c = tripCosts(trip)
  const origin = AIRPORTS.find((a) => a.code === trip.origin)
  return (
    <aside aria-label="Trip summary" className="surface p-4 sm:p-5">
      <h2 className="mb-1 text-lg font-semibold">The trip in numbers</h2>
      <p className="mb-3 text-xs text-slate">All amounts are euro per person.</p>
      <dl className="divide-y divide-line text-sm">
        <Row label="Nights" value={trip.nights} />
        <Row label="Travelling" value={<span className="font-sans">{trip.travellers}</span>} />
        <Row label="Flew from" value={<span className="font-sans">{origin ? `${origin.city} (${trip.origin})` : trip.origin}</span>} />
        <Row label="Airline" value={<span className="font-sans">{trip.airline}</span>} />
      </dl>
      <dl className="mt-3 divide-y divide-line border-t border-line pt-1 text-sm">
        <Row label="Flights" value={`€${c.flight}`} />
        <Row label={`Accommodation (${trip.nights} × €${trip.accommodationPerNight})`} value={`€${c.accommodation}`} />
        <Row label={`Food (${c.days} × €${trip.foodPerDay})`} value={`€${c.food}`} />
        <Row label={`Transport (${c.days} × €${trip.transportPerDay})`} value={`€${c.transport}`} />
        {c.other !== null && <Row label={`Other (${c.days} × €${trip.otherPerDay})`} value={`€${c.other}`} />}
      </dl>
      <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-ink pt-3">
        <p className="font-semibold">Total</p>
        <p className="num text-3xl font-semibold underline decoration-amber decoration-[3px] underline-offset-[6px]">€{c.total}</p>
      </div>
      <p className="mt-3 text-xs text-slate">
        Daily costs are counted for {c.days} days. Prices are what this traveller really paid and can differ for you.
      </p>
    </aside>
  )
}
