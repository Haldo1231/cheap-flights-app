export type Hostel = {
  id: number
  name: string
  booking_url: string
  price_per_night: number | null
  rating: number | null
}

/** Hostel picks for a destination (names and links come from our own table). */
export default function HostelList({ hostels }: { hostels: Hostel[] }) {
  if (hostels.length === 0) {
    return <p className="text-sm text-slate">Hostel recommendations coming soon.</p>
  }
  return (
    <>
      <ul className="space-y-3">
        {hostels.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-4 rounded-sm border border-line bg-white p-4">
            <div className="min-w-0">
              <p className="font-semibold">{h.name}</p>
              <p className="text-sm text-slate">
                {h.price_per_night !== null ? (
                  <>
                    from <span className="font-mono tabular-nums text-ink">€{h.price_per_night}</span>/night
                  </>
                ) : (
                  'price on the hostel page'
                )}
                {h.rating !== null ? ` · rated ${h.rating}/10` : ''}
              </p>
            </div>
            <a
              href={h.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 shrink-0 items-center rounded-sm px-2 text-sm font-medium text-ink underline decoration-amber decoration-2 underline-offset-4 hover:text-amber-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              View →
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate">Hostel prices are approximate &quot;from&quot; figures and can change.</p>
    </>
  )
}
