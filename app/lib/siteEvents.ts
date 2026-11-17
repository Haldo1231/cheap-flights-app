// The two events the site counts itself (Vercel's Hobby plan has page views but no custom events):
//  - search: someone pressed "Search flights" (date mode, one way or round trip, Anywhere or a city);
//  - book_click: someone clicked a booking link (its Travelpayouts SubID: screen, trip type, home airport).
// Sent with navigator.sendBeacon to /api/event, which stores them in the `site_events` table (supabase/site_events.sql).
// No cookies, no IP address, no browser details. Counts: /api/debug-prices?key=…&events=1.

import { subIdOf } from './subId'

export type SearchEvent = { name: 'search'; mode: 'exact' | 'month' | 'range'; trip: 'ow' | 'rt'; anywhere: boolean }
export type BookClickEvent = { name: 'book_click'; subId: string | null }
export type SiteEvent = SearchEvent | BookClickEvent

export function trackEvent(event: SiteEvent): void {
  try {
    const body = JSON.stringify(event)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/event', body)) return
    void fetch('/api/event', { method: 'POST', body, keepalive: true }).catch(() => {})
  } catch {
    // Counting must never break the page.
  }
}

/** A click on a booking link (tp.media), with the SubID the link carries. */
export function trackBookingClick(href: string): void {
  trackEvent({ name: 'book_click', subId: subIdOf(href) })
}
