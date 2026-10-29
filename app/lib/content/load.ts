// Reads the trip reports and guides from the Markdown files in /content, checks them against
// the schema and hands them to the pages. Server code only (it reads files).
//
//  - Drafts (`draft: true`) are only returned while developing (`npm run dev`); production
//    builds, listings, the sitemap and the pages themselves never see them.
//  - Every file is checked even when it is a draft, so a mistake always shows up at build time.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import type { ZodType } from 'zod'
import { guideSchema, tripSchema, type Guide, type Trip } from './schema'

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, 'content')

/** Drafts are visible only in development. */
function showDrafts(): boolean {
  return process.env.NODE_ENV !== 'production'
}

/** Pictures can be checked while developing and while building. At run time on the host the
 * public folder is served by the CDN and may not exist on the function's disk. */
function canCheckFiles(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE === 'phase-production-build'
}

type Kind = 'trips' | 'guides'

function readEntries<T extends { slug: string; draft: boolean; cover?: { src: string }; photos?: { src: string }[] }>(
  kind: Kind,
  schema: ZodType<Omit<T, 'body'>>
): (T & { body: string })[] {
  const dir = path.join(CONTENT_DIR, kind)
  if (!existsSync(dir)) return []
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort()

  const problems: string[] = []
  const entries: (T & { body: string })[] = []

  for (const file of files) {
    const where = `content/${kind}/${file}`
    const raw = readFileSync(path.join(dir, file), 'utf8')
    let parsed: matter.GrayMatterFile<string>
    try {
      parsed = matter(raw)
    } catch (error) {
      problems.push(`${where}: the top part (between the --- lines) is not valid: ${(error as Error).message.split('\n')[0]}`)
      continue
    }

    const result = schema.safeParse(parsed.data)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path.length ? issue.path.join('.') : '(top of file)'
        const missing = issue.code === 'invalid_type' && /received undefined/.test(issue.message)
        problems.push(`${where}: field "${field}" ${missing ? 'is missing' : `is wrong: ${issue.message}`}`)
      }
      continue
    }

    const data = result.data as Omit<T, 'body'>
    const entry = { ...data, body: parsed.content.trim() } as T & { body: string }

    if (`${entry.slug}.md` !== file) problems.push(`${where}: "slug" is "${entry.slug}" but the file is called "${file}". They must match.`)
    if (/!\[[^\]]*\]\(/.test(entry.body)) {
      problems.push(`${where}: pictures inside the text are not supported. Put them in the "photos" list in the top part so they get a description (alt) and a caption.`)
    }
    if (canCheckFiles()) {
      const pictures = [...(entry.cover ? [entry.cover.src] : []), ...(entry.photos ?? []).map((p) => p.src)]
      for (const src of pictures) {
        const file = path.join(ROOT, 'public', kind, entry.slug, src)
        if (!existsSync(file)) problems.push(`${where}: the picture "${src}" is not in public/${kind}/${entry.slug}/`)
      }
    }
    entries.push(entry)
  }

  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.slug)) problems.push(`content/${kind}: two files use the slug "${entry.slug}"`)
    seen.add(entry.slug)
  }

  if (problems.length > 0) {
    throw new Error(`\nThe content files have problems. Fix these and try again:\n  - ${problems.join('\n  - ')}\n`)
  }
  return entries
}

type Dated = { date: string; title: string }
const newestFirst = (a: Dated, b: Dated) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)

let cache: { trips: Trip[]; guides: Guide[] } | null = null

function load(): { trips: Trip[]; guides: Guide[] } {
  // In development the files are read again every time, so edits show up on reload.
  if (cache && process.env.NODE_ENV === 'production') return cache
  const trips = readEntries<Trip>('trips', tripSchema as unknown as ZodType<Omit<Trip, 'body'>>)
  const guides = readEntries<Guide>('guides', guideSchema as unknown as ZodType<Omit<Guide, 'body'>>)
  cache = { trips, guides }
  return cache
}

const visible = <T extends { draft: boolean }>(list: T[]) => (showDrafts() ? list : list.filter((e) => !e.draft))

export function getTrips(): Trip[] {
  return visible(load().trips).sort(newestFirst)
}

export function getTrip(slug: string): Trip | null {
  return getTrips().find((t) => t.slug === slug) ?? null
}

export function getGuides(): Guide[] {
  return visible(load().guides).sort(newestFirst)
}

export function getGuide(slug: string): Guide | null {
  return getGuides().find((g) => g.slug === slug) ?? null
}
