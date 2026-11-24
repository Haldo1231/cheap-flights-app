'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AUTH_ENABLED } from '../lib/auth/config'
import { signInWithGoogle } from '../lib/auth/browser'
import { useAuthUser } from '../lib/auth/useAuthUser'
import { searchQuery, type SavedSearch } from '../lib/saved/search'
import { HeartIcon } from './Icons'

type Props = {
  /** The route and dates to save; null = this screen has nothing saveable (the button is not shown). */
  search: SavedSearch | null
  className?: string
}

/** What the server said for one visitor + search (`key`), so a sign-in or another search starts a new check. */
type Known = { key: string; id: number | null; busy: boolean }

/** The heart: saves this route and its dates to the visitor's list (/saved). Signed out, a tap asks to sign in with Google,
 * and the route is saved as part of coming back from Google (auth/callback). Hidden when sign-in is off. */
export default function SaveButton(props: Props) {
  if (!AUTH_ENABLED || !props.search) return null
  return <Heart {...props} search={props.search} />
}

function Heart({ search, className = '' }: Props & { search: SavedSearch }) {
  const user = useAuthUser()
  const query = searchQuery(search)
  const [known, setKnown] = useState<Known | null>(null)
  const [asking, setAsking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const panelId = useId()
  const wrap = useRef<HTMLSpanElement>(null)

  const key = user ? `${user.id}|${query}` : null
  // Signed out = not saved; signed in = what the server said for this visitor and search (checking until it answers).
  const state: { status: 'checking' } | { status: 'ready' | 'busy'; id: number | null } =
    user === null
      ? { status: 'ready', id: null }
      : key && known?.key === key
        ? { status: known.busy ? 'busy' : 'ready', id: known.id }
        : { status: 'checking' }
  const setState = (next: { status: 'ready' | 'busy'; id: number | null }) => key && setKnown({ key, id: next.id, busy: next.status === 'busy' })

  // Is this search saved already? Asked again when the visitor signs in or out.
  useEffect(() => {
    if (!key) return
    let live = true
    fetch(`/api/saved?${query}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { id: number | null } | null) => {
        if (live) setKnown({ key, id: body?.id ?? null, busy: false })
      })
      .catch(() => {
        if (live) setKnown({ key, id: null, busy: false })
      })
    return () => {
      live = false
    }
  }, [key, query])

  // The sign-in question closes with Escape or a tap outside it.
  useEffect(() => {
    if (!asking) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAsking(false)
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setAsking(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [asking])

  // A short note after saving or removing fades after a few seconds.
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 3500)
    return () => clearTimeout(t)
  }, [message])

  const savedId = state.status === 'checking' ? null : state.id
  const saved = savedId !== null

  async function toggle() {
    setMessage(null)
    if (!user) {
      setAsking((a) => !a)
      return
    }
    if (state.status !== 'ready') return
    setState({ status: 'busy', id: state.id })
    try {
      const res = saved
        ? await fetch(`/api/saved?id=${savedId}`, { method: 'DELETE' })
        : await fetch('/api/saved', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ search }) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(body.error ?? 'Something went wrong. Please try again.')
        setState({ status: 'ready', id: savedId })
        return
      }
      setState({ status: 'ready', id: saved ? null : body.id ?? null })
      setMessage(saved ? 'Removed from your saved routes' : 'Saved to your saved routes')
    } catch {
      setMessage('No connection. Please try again.')
      setState({ status: 'ready', id: savedId })
    }
  }

  async function signIn() {
    const problem = await signInWithGoogle({ save: JSON.stringify(search) })
    if (problem) setMessage(problem)
  }

  const label = saved ? 'Saved' : 'Save route'

  return (
    <span ref={wrap} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        aria-expanded={user === null ? asking : undefined}
        aria-controls={user === null ? panelId : undefined}
        disabled={state.status === 'busy'}
        title={saved ? 'Remove from your saved routes' : 'Save this route and these dates'}
        className={`btn btn-outline ${saved ? 'border-amber' : ''} disabled:opacity-60`}
      >
        <HeartIcon filled={saved} className={`h-5 w-5 ${saved ? 'text-amber' : ''}`} />
        <span>{label}</span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {message ?? ''}
      </span>
      {message && !asking && (
        <span aria-hidden="true" className="fade-in pointer-events-none absolute left-0 top-full z-20 mt-1.5 whitespace-nowrap rounded-md bg-deep px-2.5 py-1 text-xs font-medium text-white shadow-lift">
          {message}
        </span>
      )}
      {asking && user === null && (
        <span
          id={panelId}
          role="dialog"
          aria-label="Sign in to save"
          className="fade-in absolute left-0 top-full z-30 mt-2 block w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-4 text-left text-sm text-ink shadow-lift"
        >
          <span className="mb-1 block font-semibold">Sign in to save this route</span>
          <span className="mb-3 block text-slate">
            We keep the route and dates, and show you how the price moved since. After signing in, it is saved for you.
          </span>
          <button type="button" onClick={signIn} className="btn btn-primary w-full">
            Continue with Google
          </button>
        </span>
      )}
    </span>
  )
}
