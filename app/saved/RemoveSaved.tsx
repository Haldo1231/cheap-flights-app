'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** "Remove" on /saved: deletes the saved search, then the list is drawn again. */
export default function RemoveSaved({ id, label }: { id: number; label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setProblem(null)
    try {
      const res = await fetch(`/api/saved?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setProblem('Could not remove it. Try again.')
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={remove} disabled={busy} aria-label={`Remove ${label}`} className="btn btn-outline disabled:opacity-60">
        {busy ? 'Removing…' : 'Remove'}
      </button>
      {problem && (
        <span role="alert" className="mt-1 text-xs text-danger">
          {problem}
        </span>
      )}
    </span>
  )
}
