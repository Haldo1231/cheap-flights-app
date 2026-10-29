import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t-4 border-amber bg-deep text-white/80">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-sm sm:grid-cols-3 sm:px-6">
        <div>
          <p className="num text-lg font-semibold text-white">
            cheap<span className="text-amber">flights</span>
          </p>
          <p className="mt-2 max-w-xs">
            One search across Bratislava, Vienna, Budapest, Košice and Prague.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-white/60">Explore</p>
          <ul className="space-y-1">
            <li>
              <Link href="/search" className="inline-flex min-h-9 items-center hover:text-amber">
                Search flights
              </Link>
            </li>
            <li>
              <Link href="/anywhere" className="inline-flex min-h-9 items-center hover:text-amber">
                Where can I fly cheaply?
              </Link>
            </li>
            <li>
              <Link href="/deals" className="inline-flex min-h-9 items-center hover:text-amber">
                This week&apos;s deals
              </Link>
            </li>
            <li>
              <Link href="/trips" className="inline-flex min-h-9 items-center hover:text-amber">
                Trip reports
              </Link>
            </li>
            <li>
              <Link href="/guides" className="inline-flex min-h-9 items-center hover:text-amber">
                Guides
              </Link>
            </li>
            <li>
              <Link href="/about" className="inline-flex min-h-9 items-center hover:text-amber">
                About
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-white/60">Good to know</p>
          <p>
            Prices come from cached data and can be out of date — always confirm the final price on the booking site. We
            earn a small commission when you book through our links, at no extra cost to you.{' '}
            <Link href="/disclosure" className="underline decoration-amber underline-offset-4 hover:text-amber">
              Affiliate disclosure
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
