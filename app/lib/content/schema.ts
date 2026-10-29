// What a trip report or a guide file must contain (the "frontmatter" at the top of the
// Markdown file). Anything missing or misspelled stops the build with a clear message,
// so a half-filled entry can never reach the live site.

import { z } from 'zod'
import { DESTINATIONS } from '../../destinationsList'

const DESTINATION_SLUGS = DESTINATIONS.map((d) => d.slug)

/** A file name / address part: lowercase letters, numbers, dashes. */
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use lowercase letters, numbers and dashes only, e.g. "rome-with-a-friend"')

const destinationSlug = z
  .string()
  .refine((value) => DESTINATION_SLUGS.includes(value), `must be one of our destinations: ${DESTINATION_SLUGS.join(', ')}`)

/** YYYY-MM-DD. (YAML turns an unquoted date into a Date object: that is accepted too.) */
const date = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'use the form YYYY-MM-DD, e.g. 2026-03-14')
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'this is not a real date')
)

const text = (what: string) => z.string().trim().min(1, `${what} must not be empty`)

const money = z.number({ error: 'must be a number in euro, e.g. 42' }).min(0, 'must not be negative').max(100000, 'looks too large')

/** A picture inside public/trips/<slug>/ (or public/guides/<slug>/). The description (alt) is
 * what screen readers read and what shows if the picture cannot load, so it is required. */
export const photoSchema = z
  .object({
    src: text('src (the file name)').regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\.(webp|jpg|jpeg|png|avif|svg)$/i, 'use just the file name, e.g. "01-market.webp"'),
    alt: text('alt (describe the photo in one sentence for people who cannot see it)'),
    caption: z.string().trim().min(1).optional(),
  })
  .strict()

const coverSchema = z
  .object({
    src: photoSchema.shape.src,
    alt: photoSchema.shape.alt,
  })
  .strict()

const language = z.string().regex(/^[a-z]{2}$/, 'use a two-letter language code, e.g. "en" or "sk"').default('en')

export const tripSchema = z
  .object({
    title: text('title'),
    slug,
    date,
    /** One of our destination pages (enables the "compare with our estimate" box). */
    destination: destinationSlug.optional(),
    country: text('country'),
    nights: z.number({ error: 'must be a whole number of nights' }).int().min(1).max(365),
    /** Days the daily costs are counted for. Leave out to use nights + 1. */
    days: z.number().int().min(1).max(366).optional(),
    travellers: text('travellers (for example "solo" or "with a friend")'),
    origin: z.string().regex(/^[A-Z]{3}$/, 'use the 3-letter airport code, e.g. "KSC"'),
    airline: text('airline'),
    flightPricePerPerson: money,
    accommodationPerNight: money,
    foodPerDay: money,
    transportPerDay: money,
    otherPerDay: money.optional(),
    description: z.string().trim().min(1).max(200).optional(),
    tips: z.array(text('a tip')).default([]),
    mistakes: z.array(text('an entry in mistakes')).default([]),
    cover: coverSchema.optional(),
    photos: z.array(photoSchema).default([]),
    draft: z.boolean().default(false),
    language,
  })
  .strict()

export const guideSchema = z
  .object({
    title: text('title'),
    slug,
    description: text('description').pipe(z.string().max(200, 'keep it to 200 characters or fewer')),
    date,
    tags: z.array(text('a tag')).default([]),
    relatedDestinations: z.array(destinationSlug).default([]),
    cover: coverSchema.optional(),
    draft: z.boolean().default(false),
    language,
  })
  .strict()

export type TripMeta = z.infer<typeof tripSchema>
export type GuideMeta = z.infer<typeof guideSchema>
export type Photo = z.infer<typeof photoSchema>

export type Trip = TripMeta & { body: string }
export type Guide = GuideMeta & { body: string }
