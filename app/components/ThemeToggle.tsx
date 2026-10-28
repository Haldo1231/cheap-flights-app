'use client'

import { useSyncExternalStore } from 'react'
import { MoonIcon, SunIcon } from './Icons'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const EVENT = 'themechange'
const DARK_QUERY = '(prefers-color-scheme: dark)'

/** What the page looks like right now: the saved choice, otherwise the system setting. */
function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') return chosen
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    media.removeEventListener('change', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}

/** The sun/moon switch in the header. The site follows the system setting until this is
 * used; after that the chosen side is remembered on this device. */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light' as Theme)
  const next: Theme = theme === 'dark' ? 'light' : 'dark'

  function choose() {
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: the choice just lasts until the page closes.
    }
    window.dispatchEvent(new Event(EVENT))
  }

  return (
    <button
      type="button"
      onClick={choose}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/85 transition duration-150 hover:bg-white/10 hover:text-amber active:scale-95 motion-reduce:transition-none motion-reduce:active:transform-none"
    >
      {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  )
}
