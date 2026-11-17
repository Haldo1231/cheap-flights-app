'use client'

import { useEffect } from 'react'
import { trackBookingClick } from '../lib/siteEvents'

/** Counts clicks on booking links anywhere on the site (one listener for every page; the link's SubID says where it was). */
export default function SiteEvents() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.type === 'auxclick' && e.button !== 1) return // only the middle button opens a link
      const a = (e.target as Element | null)?.closest?.('a[href^="https://tp.media/r?"]') as HTMLAnchorElement | null
      if (a) trackBookingClick(a.href)
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('auxclick', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('auxclick', onClick, true)
    }
  }, [])
  return null
}
