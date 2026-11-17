// The airports people fly FROM on this site (used as the default search origins).
export const HOME_AIRPORTS = ['BTS', 'VIE', 'BUD', 'KSC', 'PRG']

/** The rows the `airports` table needs for the home airports (weekly_deals.origin must name one of them). The deals job adds
 * any that are missing (Prague was missing until 17 Nov 2026, so a Prague deal made the whole insert fail). */
export const HOME_AIRPORT_ROWS = [
  { code: 'BTS', name: 'Bratislava Airport', city: 'Bratislava', country: 'Slovakia' },
  { code: 'VIE', name: 'Vienna International Airport', city: 'Vienna', country: 'Austria' },
  { code: 'BUD', name: 'Budapest Ferenc Liszt Airport', city: 'Budapest', country: 'Hungary' },
  { code: 'KSC', name: 'Košice Airport', city: 'Košice', country: 'Slovakia' },
  { code: 'PRG', name: 'Václav Havel Airport Prague', city: 'Prague', country: 'Czechia' },
]
