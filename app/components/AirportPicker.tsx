'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { AIRPORTS } from '../airportsList'
import Flag from './Flag'
import { PlaneIcon } from './Icons'

type Props = {
  onSelect: (code: string, city: string) => void
  placeholder: string
  /** Accessible name of the input (what this field is for). */
  label: string
  /** When provided, shows an "Anywhere" button and option for destination fields
   * that can search every destination instead of one specific city. */
  onSelectAnywhere?: () => void
}

const MAX_OPTIONS = 7

type Option = { key: string; code: string; city: string; detail: string; countryCode?: string; anywhere?: boolean }

/** Type a city, airport code or country and pick from the list. Works with the
 * keyboard (arrows, Enter, Esc) and is announced properly by screen readers. */
export default function AirportPicker({ onSelect, placeholder, label, onSelectAnywhere }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  // null = the user has not moved yet: Enter then picks the best city match.
  const [active, setActive] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase()
    const matches = q
      ? AIRPORTS.filter(
          (a) => a.city.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || a.country.toLowerCase().includes(q)
        )
          // cities that START with what was typed come first
          .sort((a, b) => Number(b.city.toLowerCase().startsWith(q)) - Number(a.city.toLowerCase().startsWith(q)))
          .slice(0, MAX_OPTIONS)
          .map((a) => ({ key: a.code, code: a.code, city: a.city, detail: `${a.country} · ${a.code}`, countryCode: a.countryCode }))
      : []
    const anywhere: Option[] = onSelectAnywhere
      ? [{ key: 'ANYWHERE', code: 'ANYWHERE', city: 'Anywhere', detail: 'search all destinations', anywhere: true }]
      : []
    return [...anywhere, ...matches]
  }, [query, onSelectAnywhere])

  const showList = open && (options.length > 0 || query.trim().length > 0)
  // While typing, the first real city (not the "Anywhere" shortcut) is the default.
  const firstCity = options.findIndex((o) => !o.anywhere)
  const defaultIndex = query.trim() && firstCity >= 0 ? firstCity : 0
  const activeIndex = Math.min(active ?? defaultIndex, Math.max(options.length - 1, 0))

  function choose(option: Option) {
    if (option.anywhere) onSelectAnywhere?.()
    else onSelect(option.code, option.city)
    setQuery('')
    setOpen(false)
    setActive(null)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive(Math.min(activeIndex + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(Math.max(activeIndex - 1, 0))
    } else if (e.key === 'Enter') {
      if (showList && options[activeIndex]) {
        e.preventDefault()
        choose(options[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      {onSelectAnywhere && (
        <button
          type="button"
          onClick={onSelectAnywhere}
          className="mb-2 flex min-h-11 w-full items-center gap-2 rounded-sm border border-amber bg-amber-soft px-3 text-left text-sm font-medium text-ink transition-colors hover:bg-amber-soft-hover"
        >
          <PlaneIcon className="h-4 w-4 text-amber-ink" /> Anywhere — search all destinations
        </button>
      )}
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && options[activeIndex] ? `${listId}-${options[activeIndex].key}` : undefined}
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(null)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="field"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={`${label} suggestions`}
        hidden={!showList}
        className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-surface shadow-lift"
      >
        {options.map((option, i) => (
          <li
            key={option.key}
            id={`${listId}-${option.key}`}
            role="option"
            aria-selected={i === activeIndex}
            // mousedown (not click) so the input does not lose focus first
            onMouseDown={(e) => {
              e.preventDefault()
              choose(option)
            }}
            onMouseEnter={() => setActive(i)}
            className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm ${
              i === activeIndex ? 'bg-amber-soft' : ''
            } ${option.anywhere ? 'border-b border-line font-medium' : ''}`}
          >
            <span className="flex items-center gap-2">
              {option.anywhere ? <PlaneIcon className="h-4 w-4 text-amber-ink" /> : <Flag code={option.countryCode} eager />}
              {option.anywhere ? 'Anywhere' : option.city}
            </span>
            <span className="num text-xs text-slate">{option.detail}</span>
          </li>
        ))}
        {options.filter((o) => !o.anywhere).length === 0 && query.trim().length > 0 && (
          <li role="presentation" className="px-3 py-3 text-sm text-slate">
            No airport found for &quot;{query}&quot;. Try a city, a code like BCN, or a country.
          </li>
        )}
      </ul>
    </div>
  )
}
