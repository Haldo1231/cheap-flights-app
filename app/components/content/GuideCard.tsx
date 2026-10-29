import Link from 'next/link'
import type { Guide } from '../../lib/content/schema'
import { longDate } from '../../lib/content/costs'
import ContentImage from './ContentImage'

/** One guide in a list: optional cover, title, description and tags. */
export default function GuideCard({ guide, eager = false }: { guide: Guide; eager?: boolean }) {
  return (
    <li className="group transition-transform duration-300 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:transform-none">
      <Link href={`/guides/${guide.slug}`} lang={guide.language} className="surface flex h-full flex-col overflow-hidden transition-shadow duration-300 group-hover:shadow-lift sm:flex-row">
        {guide.cover && (
          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-deep sm:aspect-auto sm:w-56">
            <ContentImage
              kind="guides"
              slug={guide.slug}
              src={guide.cover.src}
              alt={guide.cover.alt}
              sizes="(min-width: 640px) 224px, 100vw"
              eager={eager}
            />
          </div>
        )}
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <p className="font-mono text-xs uppercase tracking-wide text-slate">
            {longDate(guide.date)}
            {guide.draft && <span className="ml-2 rounded-full bg-danger-bg px-2 py-0.5 text-danger ring-1 ring-danger-line">Draft, development only</span>}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug">{guide.title}</h2>
          <p className="mt-1 text-sm text-slate">{guide.description}</p>
          {guide.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
              {guide.tags.map((tag) => (
                <li key={tag} className="rounded-full border border-line bg-paper px-2.5 py-0.5 font-mono text-[11px] text-slate">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Link>
    </li>
  )
}
