// The money maths for a trip report. Everything is worked out from the numbers written in the
// file and nothing is guessed: a figure that cannot be worked out comes back as null.
//
// How a trip is counted (also written in the README):
//  - accommodation = price per night x nights
//  - food, transport and other = price per day x days (days = nights + 1 unless the file says otherwise)
//  - total = flight + accommodation + food + transport + other, per person

import type { Trip } from './schema'

export type TripCosts = {
  days: number
  flight: number
  accommodation: number
  food: number
  transport: number
  /** null when the file has no "otherPerDay". */
  other: number | null
  total: number
  /** Accommodation + food + transport + other for ONE day; null when "otherPerDay" is missing. */
  perDay: number | null
}

export function tripCosts(trip: Pick<Trip, 'nights' | 'days' | 'flightPricePerPerson' | 'accommodationPerNight' | 'foodPerDay' | 'transportPerDay' | 'otherPerDay'>): TripCosts {
  const days = trip.days ?? trip.nights + 1
  const accommodation = trip.accommodationPerNight * trip.nights
  const food = trip.foodPerDay * days
  const transport = trip.transportPerDay * days
  const other = trip.otherPerDay === undefined ? null : trip.otherPerDay * days
  const total = trip.flightPricePerPerson + accommodation + food + transport + (other ?? 0)
  const perDay =
    trip.otherPerDay === undefined ? null : trip.accommodationPerNight + trip.foodPerDay + trip.transportPerDay + trip.otherPerDay
  return { days, flight: trip.flightPricePerPerson, accommodation, food, transport, other, total, perDay }
}

export type EstimateInfo = {
  hostel_avg_price: number | null
  food_avg_price: number | null
  transport_avg_price: number | null
  other_avg_price: number | null
}

export type CompareRow = { label: string; actual: number; estimate: number; difference: number }

/** Actual spend next to our estimate, row by row. A row only exists when BOTH numbers exist. */
export function compareWithEstimate(trip: Trip, info: EstimateInfo | null): { rows: CompareRow[]; day: CompareRow | null } {
  if (!info) return { rows: [], day: null }
  const pairs: [string, number | undefined, number | null][] = [
    ['Accommodation per night', trip.accommodationPerNight, info.hostel_avg_price],
    ['Food per day', trip.foodPerDay, info.food_avg_price],
    ['Transport per day', trip.transportPerDay, info.transport_avg_price],
    ['Other per day', trip.otherPerDay, info.other_avg_price],
  ]
  const rows: CompareRow[] = []
  for (const [label, actual, estimate] of pairs) {
    if (actual === undefined || estimate === null || estimate === undefined) continue
    rows.push({ label, actual, estimate, difference: actual - estimate })
  }
  // A whole-day line only when all four pairs exist, otherwise it would compare different things.
  const day =
    rows.length === 4
      ? {
          label: 'Total per day',
          actual: rows.reduce((sum, r) => sum + r.actual, 0),
          estimate: rows.reduce((sum, r) => sum + r.estimate, 0),
          difference: rows.reduce((sum, r) => sum + r.difference, 0),
        }
      : null
  return { rows, day }
}

/** "12 March 2026" from "2026-03-12" (no timezone shifting). */
export function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${d} ${months[m - 1]} ${y}`
}
