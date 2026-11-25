'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { browserAuth } from './browser'

/** The signed-in visitor in the browser: undefined while checking, null when signed out (or sign-in is off). For what to
 * SHOW only; every write is checked again on the server. */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(() => (browserAuth() ? undefined : null))
  useEffect(() => {
    const auth = browserAuth()
    if (!auth) return
    let live = true
    auth.auth.getSession().then(({ data }) => {
      if (live) setUser(data.session?.user ?? null)
    })
    const { data } = auth.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => {
      live = false
      data.subscription.unsubscribe()
    }
  }, [])
  return user
}

/** The name to show for a visitor (Google's full name, else the part of the e-mail before @). */
export function displayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const name = (typeof meta?.full_name === 'string' && meta.full_name) || (typeof meta?.name === 'string' && meta.name) || ''
  return name || (user.email ? user.email.split('@')[0] : 'Signed in')
}

/** Google's profile picture, when there is one. */
export function avatarUrl(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const url = (typeof meta?.avatar_url === 'string' && meta.avatar_url) || (typeof meta?.picture === 'string' && meta.picture) || ''
  return url.startsWith('https://') ? url : null
}
