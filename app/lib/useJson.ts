'use client'

import { useEffect, useState } from 'react'

// Small fetch hook for the results views.
//  - Loading is derived (not set inside the effect), so a stale answer for an
//    old URL can never show up for a new one.
//  - Answers are remembered for a few minutes: pressing Back shows the
//    previous screen instantly, at full height, so the browser can put the
//    scroll position back where it was.

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { at: number; data: unknown }>()

function readCache<T>(key: string): T | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return undefined
  }
  return hit.data as T
}

export type JsonState<T> = { data: T | null; loading: boolean; error: boolean }

/** Pass null as the url to skip fetching. Change `retryNonce` to force a reload. */
export function useJson<T>(url: string | null, retryNonce = 0): JsonState<T> {
  const key = url ? `${url}#${retryNonce}` : null
  const [result, setResult] = useState<{ key: string; data: T | null; error: boolean } | null>(null)
  const cached = key ? readCache<T>(key) : undefined

  useEffect(() => {
    if (!url || !key || readCache(key) !== undefined) return
    let cancelled = false
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: T) => {
        cache.set(key, { at: Date.now(), data })
        if (!cancelled) setResult({ key, data, error: false })
      })
      .catch(() => {
        if (!cancelled) setResult({ key, data: null, error: true })
      })
    return () => {
      cancelled = true
    }
  }, [url, key])

  if (!key) return { data: null, loading: false, error: false }
  if (cached !== undefined) return { data: cached, loading: false, error: false }
  if (result && result.key === key) return { data: result.data, loading: false, error: result.error }
  return { data: null, loading: true, error: false }
}
