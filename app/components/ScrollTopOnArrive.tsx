'use client'

import { useEffect } from 'react'
import { consumeScrollTop } from '../lib/scroll'

/** Put at the top of a screen: scrolls to the top when the screen was reached
 * by a forward click (see lib/scroll), and leaves the scroll alone on Back. */
export default function ScrollTopOnArrive() {
  useEffect(() => {
    if (consumeScrollTop()) window.scrollTo({ top: 0 })
  }, [])
  return null
}
