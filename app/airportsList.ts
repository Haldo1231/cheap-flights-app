export const AIRPORTS = [
  { code: 'BTS', city: 'Bratislava', country: 'Slovakia', countryCode: 'SK' },
  { code: 'VIE', city: 'Vienna', country: 'Austria', countryCode: 'AT' },
  { code: 'BUD', city: 'Budapest', country: 'Hungary', countryCode: 'HU' },
  { code: 'KSC', city: 'Košice', country: 'Slovakia', countryCode: 'SK' },
  { code: 'ROM', city: 'Rome', country: 'Italy', countryCode: 'IT' },
  { code: 'MIL', city: 'Milan', country: 'Italy', countryCode: 'IT' },
  { code: 'BCN', city: 'Barcelona', country: 'Spain', countryCode: 'ES' },
  { code: 'VLC', city: 'Valencia', country: 'Spain', countryCode: 'ES' },
  { code: 'MAD', city: 'Madrid', country: 'Spain', countryCode: 'ES' },
  { code: 'ATH', city: 'Athens', country: 'Greece', countryCode: 'GR' },
  { code: 'PAR', city: 'Paris', country: 'France', countryCode: 'FR' },
  { code: 'LON', city: 'London', country: 'United Kingdom', countryCode: 'GB' },
  { code: 'BER', city: 'Berlin', country: 'Germany', countryCode: 'DE' },
  { code: 'MUC', city: 'Munich', country: 'Germany', countryCode: 'DE' },
  { code: 'AMS', city: 'Amsterdam', country: 'Netherlands', countryCode: 'NL' },
  { code: 'LIS', city: 'Lisbon', country: 'Portugal', countryCode: 'PT' },
  { code: 'OPO', city: 'Porto', country: 'Portugal', countryCode: 'PT' },
  { code: 'WAW', city: 'Warsaw', country: 'Poland', countryCode: 'PL' },
  { code: 'KRK', city: 'Krakow', country: 'Poland', countryCode: 'PL' },
  { code: 'PRG', city: 'Prague', country: 'Czechia', countryCode: 'CZ' },
  { code: 'ZAG', city: 'Zagreb', country: 'Croatia', countryCode: 'HR' },
  { code: 'SPU', city: 'Split', country: 'Croatia', countryCode: 'HR' },
  { code: 'DBV', city: 'Dubrovnik', country: 'Croatia', countryCode: 'HR' },
  { code: 'CPH', city: 'Copenhagen', country: 'Denmark', countryCode: 'DK' },
  { code: 'STO', city: 'Stockholm', country: 'Sweden', countryCode: 'SE' },
  { code: 'OSL', city: 'Oslo', country: 'Norway', countryCode: 'NO' },
  { code: 'HEL', city: 'Helsinki', country: 'Finland', countryCode: 'FI' },
  { code: 'DUB', city: 'Dublin', country: 'Ireland', countryCode: 'IE' },
  { code: 'BRU', city: 'Brussels', country: 'Belgium', countryCode: 'BE' },
  { code: 'ZRH', city: 'Zurich', country: 'Switzerland', countryCode: 'CH' },
  { code: 'IST', city: 'Istanbul', country: 'Turkey', countryCode: 'TR' },
]

/** The two-letter country code of one of our airports/cities (for its flag), or null. */
export function airportCountryCode(code: string | null | undefined): string | null {
  if (!code) return null
  return AIRPORTS.find((a) => a.code === code.toUpperCase())?.countryCode ?? null
}
