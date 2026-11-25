'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { browserAuth } from '../lib/auth/browser'

/** "Delete my account" at the bottom of /saved: a second, explicit confirmation, then the account and every saved route are
 * deleted (/api/account) and the visitor is signed out. */
export default function DeleteAccount({ count }: { count: number }) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setProblem(null)
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'delete my account' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.')
      await browserAuth()?.auth.signOut({ scope: 'local' })
      router.replace('/saved?deleted=1')
      router.refresh()
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <section id="delete-account" aria-labelledby="delete-title" className="mt-12 rounded-lg border border-line px-5 py-5">
      <h2 id="delete-title" className="text-base font-semibold text-ink">
        Delete my account
      </h2>
      <p className="mt-1 text-sm text-slate">
        Deletes your account and {count === 1 ? 'your saved route' : `all ${count} saved routes`} straight away. It cannot be undone.
        You can sign in again later, but you start with an empty list.
      </p>
      {!asking ? (
        <button type="button" onClick={() => setAsking(true)} className="btn btn-outline mt-4">
          Delete my account…
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby="delete-confirm" className="mt-4 rounded-sm border border-danger-line bg-danger-bg px-4 py-4">
          <p id="delete-confirm" className="text-sm font-semibold text-ink">
            Delete your account and saved routes now?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={remove} disabled={busy} className="btn border border-danger bg-surface font-semibold text-danger hover:bg-paper disabled:opacity-60">
              {busy ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button type="button" onClick={() => setAsking(false)} disabled={busy} className="btn btn-outline">
              Keep my account
            </button>
          </div>
        </div>
      )}
      {problem && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {problem}
        </p>
      )}
    </section>
  )
}
