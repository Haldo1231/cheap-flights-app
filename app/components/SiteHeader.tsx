'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/search', label: 'Search' },
  { href: '/anywhere', label: 'Anywhere' },
  { href: '/deals', label: 'Deals' },
]

/** Top bar. The page you are on is underlined in amber (and announced to screen readers). */
export default function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="bg-ink text-white">
      <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="num -ml-2 inline-flex min-h-12 items-center rounded-sm px-2 text-base font-semibold tracking-tight focus-visible:outline-white sm:text-lg"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-1.5 h-5 w-5 text-amber" fill="currentColor">
            <path d="M3.4 20.4 21 12 3.4 3.6l-.9 6.6L14 12 2.5 13.8l.9 6.6Z" />
          </svg>
          cheap<span className="text-amber">flights</span>
        </Link>
        <ul className="flex items-center">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-12 items-center border-b-2 px-2 text-sm transition-colors sm:px-3 hover:text-amber focus-visible:outline-white ${
                    active ? 'border-amber text-white' : 'border-transparent text-white/85'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
