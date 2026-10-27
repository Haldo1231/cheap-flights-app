import { describeSearch } from '../lib/searchSummary'

/** The search the user made, as small chips (so every screen says what it is showing). */
export default function SearchSummary({ params, from }: { params: URLSearchParams; from?: string }) {
  const chips = describeSearch(params)
  if (from) chips.unshift(`From ${from}`)
  return (
    <ul className="mb-6 flex flex-wrap gap-2" aria-label="Your search">
      {chips.map((chip) => (
        <li key={chip} className="rounded-sm border border-[#E5E1D8] bg-white px-2.5 py-1 font-mono text-xs text-[#5B6472]">
          {chip}
        </li>
      ))}
    </ul>
  )
}
