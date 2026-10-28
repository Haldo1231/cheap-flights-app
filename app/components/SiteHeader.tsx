'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import { PlaneIcon } from './Icons'

const LINKS = [
  { href: '/search', label: 'Search' },
  { href: '/anywhere', label: 'Anywhere' },
  { href: '/deals', label: 'Deals' },
]

/** Top bar. The page you are on is underlined in amber (and announced to screen readers). */
export default function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="border-b border-white/5 bg-deep text-white">
      <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="num -ml-2 inline-flex min-h-12 items-center rounded-sm px-2 text-base font-semibold tracking-tight focus-visible:outline-white sm:text-lg"
        >
          <PlaneIcon className="mr-1.5 hidden h-5 w-5 text-amber min-[400px]:block" />
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
                  className={`inline-flex min-h-12 items-center border-b-2 px-1.5 text-sm transition-colors min-[400px]:px-2 sm:px-3 hover:text-amber focus-visible:outline-white ${
                    active ? 'border-amber text-white' : 'border-transparent text-white/85'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
          <li>
            <ThemeToggle />
          </li>
        </ul>
      </nav>
    </header>
  )
}
