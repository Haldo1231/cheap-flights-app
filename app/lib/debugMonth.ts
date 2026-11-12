// READ-ONLY checking tool for one month of one route (used by /api/debug-prices?month=...). It changes nothing on the site.
//
// It asks Travelpayouts live (no cache) for the two lists the one-way month calendar is built from and lists, day by day,
// where each price on the calendar comes from and whether the entry looks like a COPY. A copy is an entry of the
// "latest prices" list that has no booking site (`gate`), a flight duration of 0 and a distance of 0: the pattern of the filler
// rows we saw in a real answer (the price of a real fare repeated on neighbouring dates). It is a pattern, not a proof.
// The Travelpayouts token is never part of the output.

import { cheapestPerDay, currencyIsEuro, fetchMonthCalendarDetailed, fetchMonthOneWayDays, isCopyRow, isFreshPrice, type CalendarDayDetail } from '../flightSources'
import { formatAge, priceAgeMs } from './priceAge'

type Raw = Record<string, unknown>

/** An entry of the "latest prices" list that looks like a copy: the same rule the site uses (see isCopyRow). */
export function looksLikeFiller(entry: Raw): boolean {
  return isCopyRow({ gate: entry.gate, duration: entry.duration, distance: entry.distance })
}

const day = (iso: unknown) => (typeof iso === 'string' ? iso.slice(0, 10) : null)

async function live(url: string): Promise<{ ok: boolean; status: number; json: Raw | null }> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    return { ok: res.ok, status: res.status, json: res.ok ? ((await res.json()) as Raw) : null }
  } catch {
    return { ok: false, status: 0, json: null }
  }
}

/** The address as shown to the owner: everything but the token. */
const shown = (path: string, params: Record<string, string>) => `https://api.travelpayouts.com${path}?${new URLSearchParams({ ...params, currency: 'eur' })}`

type DayRow = {
  date: string
  price: number
  /** Where the site gets this day's price: the calendar list (v1) or the latest-prices list (v2). */
  source: 'calendar (v1)' | 'latest prices (v2)'
  /** The entry has no booking site, duration 0 and distance 0 (only checked for the latest-prices list). */
  looksLikeCopy: boolean | null
}

export async function monthDiagnosis(origins: string[], destination: string, month: string, token: string, oneWay: boolean) {
  const perOrigin: Record<string, unknown> = {}
  const siteByOrigin: Record<string, Record<string, DayRow>> = {}
  const siteDetail: Record<string, Record<string, CalendarDayDetail>> = {}
  const facts: { origin: string; latestInMonth: number; copies: number; top: { price: number; entries: number } | null }[] = []
  const oneWayCounts = { plainDays: 0, plainOneWayDays: 0, askedDays: 0, askedOneWayDays: 0 }

  for (const origin of origins) {
    const calUrl = shown('/v1/prices/calendar', { origin, destination, depart_date: month, calendar_type: 'departure_date' })
    const latestParams: Record<string, string> = { origin, destination, sorting: 'price', limit: '1000', ...(oneWay ? { one_way: 'true' } : {}) }
    const latestUrl = shown('/v2/prices/latest', latestParams)
    // The same calendar asked WITH one_way=true: does the price service then answer with one-way tickets? (read-only check)
    const calOneWayUrl = shown('/v1/prices/calendar', { origin, destination, depart_date: month, calendar_type: 'departure_date', one_way: 'true' })
    const [cal, latest, calOneWay, siteDays] = await Promise.all([
      live(`${calUrl}&token=${token}`),
      live(`${latestUrl}&token=${token}`),
      live(`${calOneWayUrl}&token=${token}`),
      // What the site itself uses for this airport (cached for up to an hour, like every other screen).
      oneWay ? fetchMonthOneWayDays(origin, destination, month, token) : fetchMonthCalendarDetailed(origin, destination, month, token),
    ])

    // --- the calendar list (v1): one entry per departure day ---
    const calData = (cal.json?.data as Record<string, Raw> | undefined) ?? {}
    const calRows = Object.entries(calData)
      .map(([key, e]) => ({
        key,
        price: e.price ?? null,
        departure_at: e.departure_at ?? null,
        return_at: e.return_at ?? null,
        isOneWay: !e.return_at,
        departureDayIsTheKey: day(e.departure_at) === key,
        inMonth: key.startsWith(month),
        expires_at: e.expires_at ?? null,
        usedBySite: key.startsWith(month) && typeof e.price === 'number' && isFreshPrice({ expiresAt: e.expires_at as string | undefined }) && (!oneWay || !e.return_at),
      }))
      .sort((a, b) => a.key.localeCompare(b.key))

    // --- the latest-prices list (v2): many entries, each with its own departure date ---
    const latestAll = Array.isArray(latest.json?.data) ? (latest.json?.data as Raw[]) : []
    const latestMonth = latestAll.filter((e) => String(e.depart_date ?? '').startsWith(month))
    const latestRows = latestMonth
      .map((e) => {
        const foundAt = (e.found_at as string | undefined) ?? null
        const age = priceAgeMs(foundAt)
        return {
          depart_date: e.depart_date ?? null,
          price: e.value ?? null,
          return_date: e.return_date ?? null,
          found_at: foundAt,
          age: age === null ? 'not in the data' : formatAge(age),
          gate: e.gate ?? null,
          duration: e.duration ?? null,
          distance: e.distance ?? null,
          stops: e.number_of_changes ?? null,
          looksLikeCopy: looksLikeFiller(e),
          usedBySite: isFreshPrice({ foundAt }) && (!oneWay || !e.return_date),
        }
      })
      .sort((a, b) => String(a.depart_date).localeCompare(String(b.depart_date)) || Number(a.price) - Number(b.price))

    // --- what the site shows for this airport, with the source of each day ---
    const site: Record<string, DayRow> = {}
    for (const [date, d] of Object.entries(siteDays)) {
      const fromLatest = d.foundAt !== null // only the latest-prices list carries a "found at" time
      const rows = fromLatest ? latestRows.filter((r) => r.depart_date === date && r.price === d.price) : []
      site[date] = {
        date,
        price: d.price,
        source: fromLatest ? 'latest prices (v2)' : 'calendar (v1)',
        looksLikeCopy: fromLatest ? (rows.length > 0 ? rows.every((r) => r.looksLikeCopy) : null) : null,
      }
    }
    siteByOrigin[origin] = site
    siteDetail[origin] = siteDays

    const valueCounts = new Map<number, number>()
    for (const r of latestRows) if (typeof r.price === 'number') valueCounts.set(r.price, (valueCounts.get(r.price) ?? 0) + 1)
    const topValues = Array.from(valueCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([price, entries]) => ({ price, entries }))

    facts.push({ origin, latestInMonth: latestRows.length, copies: latestRows.filter((r) => r.looksLikeCopy).length, top: topValues[0] ?? null })

    const askedEntries = Object.values((calOneWay.json?.data as Record<string, Raw> | undefined) ?? {})
    const asked = {
      url: calOneWayUrl,
      status: calOneWay.status,
      days: askedEntries.length,
      oneWayDays: askedEntries.filter((e) => !e.return_at).length,
      roundTripDays: askedEntries.filter((e) => !!e.return_at).length,
    }
    oneWayCounts.plainDays += calRows.length
    oneWayCounts.plainOneWayDays += calRows.filter((r) => r.isOneWay).length
    oneWayCounts.askedDays += asked.days
    oneWayCounts.askedOneWayDays += asked.oneWayDays

    perOrigin[origin] = {
      calendarList: {
        url: calUrl,
        status: cal.status,
        currency: cal.json?.currency ?? '(not named)',
        currencyAccepted: cal.json ? currencyIsEuro(cal.json) : null,
        entries: calRows.length,
        entriesWhoseDepartureDayIsNotTheKey: calRows.filter((r) => !r.departureDayIsTheKey).length,
        rows: calRows.slice(0, 40),
      },
      latestPricesList: {
        url: latestUrl,
        status: latest.status,
        currency: latest.json?.currency ?? '(not named)',
        currencyAccepted: latest.json ? currencyIsEuro(latest.json) : null,
        entriesInTheWholeAnswer: latestAll.length,
        entriesInThisMonth: latestRows.length,
        entriesInThisMonthThatLookLikeCopies: latestRows.filter((r) => r.looksLikeCopy).length,
        mostRepeatedPricesInThisMonth: topValues,
        rows: latestRows.slice(0, 60),
      },
      daysTheSiteShowsForThisAirport: Object.keys(site).length,
      calendarWithOneWayParam: asked,
    }
  }

  // --- the city calendar: the cheapest price of every day among the airports (exactly what /api/calendar shows) ---
  const merged = cheapestPerDay(siteDetail)
  const days = Object.keys(merged)
    .sort()
    .map((date) => {
      const from = merged[date].origin
      const r = siteByOrigin[from][date]
      return { date, price: r.price, from, source: r.source, looksLikeCopy: r.looksLikeCopy }
    })

  // --- plain-language summary ---
  const counts = new Map<number, number>()
  for (const d of days) counts.set(d.price, (counts.get(d.price) ?? 0) + 1)
  const [topPrice, topDays] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
  const topList = days.filter((d) => d.price === topPrice)
  const fromLatest = topList.filter((d) => d.source === 'latest prices (v2)').length
  const copies = topList.filter((d) => d.looksLikeCopy === true).length
  const readThis: string[] = []
  readThis.push(`The calendar for ${destination} in ${month} (${oneWay ? 'one way' : 'round trip'}, from ${origins.join(', ')}) shows a price on ${days.length} days.`)
  readThis.push(
    `The plain calendar answer (all airports) has ${oneWayCounts.plainDays} days, ${oneWayCounts.plainOneWayDays} of them one-way. With one_way=true it has ${oneWayCounts.askedDays} days, ${oneWayCounts.askedOneWayDays} of them one-way. If the second number stays 0, the price service ignores one_way on the calendar.`
  )
  if (topPrice !== null && topDays >= 3) {
    readThis.push(`The most repeated price is €${topPrice}: it is shown on ${topDays} of those ${days.length} days.`)
    readThis.push(`Those ${topDays} days come from: ${topList.length - fromLatest} × the calendar list (v1), ${fromLatest} × the latest-prices list (v2).`)
    readThis.push(`Of them, ${copies} look like copies (the entry has no booking site, a duration of 0 and a distance of 0, the pattern of the filler rows we saw before).`)
  } else {
    readThis.push('No single price is repeated on 3 or more days.')
  }
  // Per airport: the latest-prices list is where copies show up, even when a cheaper real fare of another airport hides them on the city calendar.
  for (const f of facts) {
    if (f.top && (f.copies > 0 || f.top.entries >= 5)) {
      readThis.push(
        `From ${f.origin}: the latest-prices list has ${f.latestInMonth} entries in ${month}; ${f.copies} look like copies; the price €${f.top.price} appears ${f.top.entries} times.`
      )
    }
  }
  readThis.push('"Looks like a copy" is a pattern, not proof. Compare the rows below: a real fare has a booking site, a duration and a distance, and is found close to its own departure date.')

  const manyCopies = facts.some((f) => f.copies >= 5)
  const pattern =
    manyCopies || (topPrice !== null && topDays >= 5 && copies / topDays >= 0.8)
      ? 'COPIES-SUSPECTED'
      : topPrice !== null && topDays >= 5
      ? 'SAME-PRICE-ON-MANY-DAYS-BUT-NOT-LIKE-COPIES-CHECK-THE-ROWS'
      : 'NO-REPEATED-PRICE-PATTERN'

  return {
    mode: `month, ${oneWay ? 'one way' : 'round trip'}`,
    destination,
    month,
    origins,
    pattern,
    readThis,
    daysOnTheCityCalendar: days,
    perOrigin,
  }
}
