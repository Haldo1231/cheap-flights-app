'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { AUTH_ENABLED } from '../lib/auth/config'
import { browserAuth, signInWithGoogle } from '../lib/auth/browser'
import { avatarUrl, displayName, useAuthUser } from '../lib/auth/useAuthUser'
import { HeartIcon } from './Icons'

async function signOut(refresh: () => void) {
  await browserAuth()?.auth.signOut()
  refresh()
}

function Avatar({ user, size = 'h-8 w-8' }: { user: User; size?: string }) {
  const url = avatarUrl(user)
  const name = displayName(user)
  if (url) {
    // A plain <img>: Google's picture server needs no resizing, and no referrer goes with the request.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" referrerPolicy="no-referrer" className={`${size} rounded-full object-cover ring-1 ring-white/30`} />
  }
  return (
    <span aria-hidden="true" className={`${size} inline-flex items-center justify-center rounded-full bg-amber font-semibold text-deep`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** The account control in the top bar (wide screens): "Sign in", or the visitor's picture with a small menu
 * (Saved routes, Sign out). Nothing at all when sign-in is off. */
export function AccountBar() {
  if (!AUTH_ENABLED) return null
  return <Bar />
}

function Bar() {
  const user = useAuthUser()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  if (user === undefined) return <span className="hidden h-10 w-10 sm:block" aria-hidden="true" />

  if (user === null) {
    return (
      <button
        type="button"
        onClick={() => signInWithGoogle()}
        className="ml-1 hidden min-h-10 items-center rounded-full border border-white/35 px-3 text-sm text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-white sm:inline-flex"
      >
        Sign in
      </button>
    )
  }

  return (
    <div ref={wrap} className="relative ml-1 hidden sm:block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account: ${displayName(user)}`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 focus-visible:outline-white"
      >
        <Avatar user={user} />
      </button>
      {open && (
        <div id={menuId} className="fade-in absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-line bg-surface p-1.5 text-sm text-ink shadow-lift">
          <p className="truncate px-3 pb-2 pt-1.5 text-xs text-slate">{displayName(user)}</p>
          <Link href="/saved" onClick={() => setOpen(false)} className="flex min-h-10 items-center gap-2 rounded-md px-3 hover:bg-paper">
            <HeartIcon className="h-4 w-4 text-amber" /> Saved routes
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              signOut(router.refresh)
            }}
            className="flex min-h-10 w-full items-center rounded-md px-3 text-left hover:bg-paper"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/** The same choices as rows of the phone menu (under the page links, so the top bar keeps one row). */
export function AccountMenuItems({ rowClass }: { rowClass: string }) {
  if (!AUTH_ENABLED) return null
  return <Items rowClass={rowClass} />
}

function Items({ rowClass }: { rowClass: string }) {
  const user = useAuthUser()
  const router = useRouter()
  if (user === undefined) return null
  if (user === null) {
    return (
      <li className="mt-2 border-t border-white/10 pt-2">
        <button type="button" onClick={() => signInWithGoogle()} className={`${rowClass} w-full border-transparent text-left text-white/85`}>
          Sign in with Google
        </button>
      </li>
    )
  }
  return (
    <>
      <li className="mt-2 flex items-center gap-3 border-t border-white/10 px-3 pb-1 pt-3 text-sm text-white/70">
        <Avatar user={user} size="h-7 w-7" />
        <span className="truncate">{displayName(user)}</span>
      </li>
      <li>
        <Link href="/saved" className={`${rowClass} border-transparent text-white/85`}>
          Saved routes
        </Link>
      </li>
      <li>
        <button type="button" onClick={() => signOut(router.refresh)} className={`${rowClass} w-full border-transparent text-left text-white/85`}>
          Sign out
        </button>
      </li>
    </>
  )
}
