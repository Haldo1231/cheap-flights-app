// The route pages (/flights/bratislava-milan): one page per home airport and destination, for search engines.
//
// WHICH routes have a page is decided ahead of time and saved in data/routes.json by scripts/build-routes.mjs
// (`npm run routes`), NOT worked out while a page is drawn. Two reasons:
//  - an address must stay the same. If the list were built from whatever is in the price store at the moment, a page
//    could appear and vanish between deployments, which is the worst thing a page can do to a search engine.
//  - a page is only worth making when the store really holds enough about the route (see THRESHOLD): a page that says
//    "no prices" helps nobody and makes 47 nearly identical pages look like filler.
// The CONTENT of a page is read from the store when the page is drawn, so prices stay current without a new build.

import routesFile from '../../data/routes.json'

/** What a route must have in the price store before it gets a page. Mirrored in scripts/build-routes.mjs, which is the
 * only thing that applies it; it is written down here so a reader of the page knows what "enough data" means.
 * `oneWayDays` and `roundTripDays` are both needed: a page shows one-way and round-trip prices side by side. */
export const THRESHOLD = {
  tickets: 30,
  departureDays: 20,
  /** Of the four months the store covers (this month + 3). */
  months: 3,
  oneWayDays: 8,
  roundTripDays: 8,
  /** The newest price of the route may not be older than this when the list is built. */
  freshHours: 72,
} as const

export type RoutePage = {
  /** The address, e.g. "bratislava-milan". */
  slug: string
  origin: string
  destination: string
  originCity: string
  destinationCity: string
  /** The country code of the destination, for its flag. */
  destinationCountry: string
  countryCode: string
  /** The matching /destinations/<slug> page, when the destination has one. */
  destinationSlug: string | null
}

type RoutesFile = { generated: string; routes: RoutePage[] }

const file = routesFile as unknown as RoutesFile

/** Every route that has a page, in the order the list was built (by home airport, then destination). */
export const ROUTE_PAGES: RoutePage[] = Array.isArray(file.routes) ? file.routes : []

/** The day the list was last built (shown nowhere; useful when checking why a route is or is not here). */
export const ROUTES_GENERATED: string = file.generated ?? ''

const bySlug = new Map(ROUTE_PAGES.map((r) => [r.slug, r]))

/** The route of an address, or null when there is no page for it. */
export function routeBySlug(slug: string): RoutePage | null {
  return bySlug.get(slug) ?? null
}

/** The other routes to the same city, from the other home airports (the "compare your airports" list). */
export function sameDestination(route: RoutePage): RoutePage[] {
  return ROUTE_PAGES.filter((r) => r.destination === route.destination && r.origin !== route.origin)
}

/** The other route pages from the same home airport (the "more from Bratislava" list). */
export function sameOrigin(route: RoutePage): RoutePage[] {
  return ROUTE_PAGES.filter((r) => r.origin === route.origin && r.destination !== route.destination)
}

/** The route pages that start at a home airport, for linking from elsewhere. */
export function routesFromAirport(origin: string): RoutePage[] {
  return ROUTE_PAGES.filter((r) => r.origin === origin)
}

/** The route pages that end at a destination, for linking from /destinations/<slug>. */
export function routesToDestination(destinationSlug: string): RoutePage[] {
  return ROUTE_PAGES.filter((r) => r.destinationSlug === destinationSlug)
}
