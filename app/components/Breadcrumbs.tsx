import Link from 'next/link'
import Flag from './Flag'

export type Crumb = { label: string; href?: string; /** Country code: shows that country's flag before the label. */ flag?: string }

/** Where you are, with every earlier step clickable. The last item is the
 * current page and is not a link. */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-9 items-center rounded-sm underline decoration-line decoration-2 underline-offset-4 hover:text-ink hover:decoration-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {item.flag && <Flag code={item.flag} size="xs" className="mr-1.5" />}
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className={isLast ? 'font-medium text-ink' : undefined}>
                  {item.flag && <Flag code={item.flag} size="xs" className="mr-1.5" />}
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span aria-hidden="true" className="text-faint">
                  ›
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
