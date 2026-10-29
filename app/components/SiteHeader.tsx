'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import { PlaneIcon } from './Icons'

const LINKS = [
  { href: '/search', label: 'Search' },
  { href: '/anywhere', label: 'Anywhere' },
  { href: '/deals', label: 'Deals' },
  { href: '/trips', label: 'Trips' },
  { href: '/guides', label: 'Guides' },
]

/** Top bar. The page you are on is underlined in amber (and announced to screen readers).
 * On phones the links live in a menu that opens under the bar. */
export default function SiteHeader() {
  const pathname = usePathname()
  const menuId = useId()
  // The menu counts as open only on the page it was opened on, so following a link closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenOn(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="relative border-b border-white/5 bg-deep text-white">
      <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="num -ml-2 inline-flex min-h-12 items-center rounded-sm px-2 text-base font-semibold tracking-tight focus-visible:outline-white sm:text-lg"
        >
          <PlaneIcon className="mr-1.5 hidden h-5 w-5 text-amber min-[400px]:block" />
          cheap<span className="text-amber">flights</span>
        </Link>

        <div className="flex items-center">
          <ul className="hidden items-center sm:flex">
            {LINKS.map((link) => {
              const active = isActive(link.href)
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex min-h-12 items-center border-b-2 px-2 text-sm transition-colors lg:px-3 hover:text-amber focus-visible:outline-white ${
                      active ? 'border-amber text-white' : 'border-transparent text-white/85'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpenOn(open ? null : pathname)}
            className="inline-flex min-h-12 items-center gap-2 rounded-sm px-2 text-sm text-white/90 transition-colors hover:text-amber focus-visible:outline-white sm:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
            Menu
          </button>

          <ThemeToggle />
        </div>
      </nav>

      {open && (
        <div id={menuId} className="absolute inset-x-0 top-full z-50 border-b border-white/10 bg-deep shadow-lift sm:hidden">
          <ul className="mx-auto max-w-5xl px-4 pb-3">
            {LINKS.map((link) => {
              const active = isActive(link.href)
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-12 items-center border-l-2 px-3 text-base transition-colors hover:text-amber focus-visible:outline-white ${
                      active ? 'border-amber text-white' : 'border-transparent text-white/85'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </header>
  )
}
