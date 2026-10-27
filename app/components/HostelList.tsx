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
    return <p className="text-sm text-[#5B6472]">Hostel recommendations coming soon.</p>
  }
  return (
    <>
      <ul className="space-y-3">
        {hostels.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-4 rounded-sm border border-[#E5E1D8] bg-white p-4">
            <div className="min-w-0">
              <p className="font-semibold">{h.name}</p>
              <p className="text-sm text-[#5B6472]">
                {h.price_per_night !== null ? (
                  <>
                    from <span className="font-mono tabular-nums text-[#14213D]">€{h.price_per_night}</span>/night
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
              className="shrink-0 rounded-sm text-sm font-medium text-[#14213D] underline decoration-[#FCA311] decoration-2 underline-offset-4 hover:text-[#8a5a00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14213D]"
            >
              View →
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[#5B6472]">Hostel prices are approximate &quot;from&quot; figures and can change.</p>
    </>
  )
}
