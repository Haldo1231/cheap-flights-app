'use client'

import { useEffect } from 'react'
import { consumeScrollTop } from '../lib/scroll'

/** Put at the top of a screen: when the screen was reached by a forward click
 * (see lib/scroll) it scrolls to the top AND moves keyboard / screen-reader focus
 * to the new heading, so nobody is left on a link that no longer exists. On Back
 * it leaves scroll and focus alone. */
export default function ScrollTopOnArrive() {
  useEffect(() => {
    if (!consumeScrollTop()) return
    window.scrollTo({ top: 0 })
    const heading = document.querySelector<HTMLElement>('main h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
  }, [])
  return null
}
