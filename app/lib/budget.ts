// The budget maths, in one place. Every screen (result lists, Whole Month, Anywhere, the cost panel,
// the trip page) calls these functions, so a total can never differ between two places.
// Nothing here is fetched: it only combines a cached flight price with a destination's cost numbers.

import { DEFAULT_LEVEL, LEVELS, LEVEL_KEYS, MAX_BUDGET, type CostCategory, type LevelKey } from '../budgetConfig'
import { nightsBetweenDates } from './format'

/** The destination's own daily cost numbers (euro). null = the database has no number. */
export type DestCosts = {
  hostel_avg_price: number | null
  food_avg_price: number | null
  transport_avg_price: number | null
  other_avg_price: number | null
}

/** Costs for ONE day at a chosen spending style, each rounded to whole euro. */
export type DayCosts = Record<CostCategory, number> & { perDay: number }

const FIELD: Record<CostCategory, keyof DestCosts> = {
  accommodation: 'hostel_avg_price',
  food: 'food_avg_price',
  transport: 'transport_avg_price',
  other: 'other_avg_price',
}

/** True only when ALL four numbers exist. A destination with a missing number is treated as having
 * no cost data: a gap would otherwise count as 0 euro and make the trip look cheaper than it is. */
export function hasCostData(info: DestCosts | null | undefined): info is DestCosts {
  if (!info) return false
  return (Object.values(FIELD) as (keyof DestCosts)[]).every((key) => {
    const value = info[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
  })
}

/** One day's costs at a spending style, or null when the destination has no cost data. */
export function dailyCosts(info: DestCosts | null | undefined, level: LevelKey = DEFAULT_LEVEL): DayCosts | null {
  if (!hasCostData(info)) return null
  const { multipliers } = LEVELS[level]
  const part = (category: CostCategory) => Math.round((info[FIELD[category]] as number) * multipliers[category])
  const costs = { accommodation: part('accommodation'), food: part('food'), transport: part('transport'), other: part('other') }
  return { ...costs, perDay: costs.accommodation + costs.food + costs.transport + costs.other }
}

/** Days of stay the estimate counts: the nights between the dates, at least 1.
 * A one-way trip, a same-day return and a broken date all count as 1 day. */
export function stayDays(nights: number | null | undefined): number {
  return typeof nights === 'number' && Number.isFinite(nights) && nights >= 1 ? Math.floor(nights) : 1
}

export type BudgetStatus = 'none' | 'within' | 'over' | 'nodata'

export type TripEstimate = {
  flight: number
  days: number
  /** Cost of one day, null when there is no cost data. */
  perDay: number | null
  stay: number | null
  /** Flight + stay, null when there is no cost data. */
  total: number | null
  /** none = no budget set; nodata = budget set but no cost data (never counted as within budget). */
  status: BudgetStatus
  /** budget - total: positive = money left, negative = over. null without a budget or cost data. */
  difference: number | null
  /** The most days of stay the budget pays for after this flight. null without a budget or cost data. */
  maxDays: number | null
}

/** The whole estimate for one trip. `nights` = nights between the dates (null/0 for one way). */
export function estimateTrip(input: {
  flight: number
  nights: number | null | undefined
  info: DestCosts | null | undefined
  level?: LevelKey
  budget: number | null
}): TripEstimate {
  const { flight, budget } = input
  const days = stayDays(input.nights)
  const costs = dailyCosts(input.info, input.level ?? DEFAULT_LEVEL)
  if (!costs) {
    return { flight, days, perDay: null, stay: null, total: null, status: budget === null ? 'none' : 'nodata', difference: null, maxDays: null }
  }
  const stay = costs.perDay * days
  const total = flight + stay
  if (budget === null) {
    return { flight, days, perDay: costs.perDay, stay, total, status: 'none', difference: null, maxDays: null }
  }
  const left = budget - flight
  return {
    flight,
    days,
    perDay: costs.perDay,
    stay,
    total,
    status: total <= budget ? 'within' : 'over',
    difference: budget - total,
    maxDays: left < 0 ? 0 : costs.perDay > 0 ? Math.floor(left / costs.perDay) : null,
  }
}

const ORDER: Record<BudgetStatus, number> = { within: 0, none: 0, over: 1, nodata: 2 }

/** Sort order for a list when a budget is set: trips within budget first (cheapest total first),
 * then trips over budget (cheapest total first), then trips with no cost data (cheapest flight first). */
export function compareEstimates(a: TripEstimate, b: TripEstimate): number {
  const byStatus = ORDER[a.status] - ORDER[b.status]
  if (byStatus !== 0) return byStatus
  if (a.total !== null && b.total !== null && a.total !== b.total) return a.total - b.total
  return a.flight - b.flight
}

/** The "how far does my budget go" sentence for one trip, or null when there is nothing to say. */
export function affordableText(estimate: TripEstimate, placeName: string, oneWay: boolean, budget: number | null): string | null {
  if (budget === null || estimate.maxDays === null) return null
  if (estimate.flight > budget) return `The flight alone is over your €${budget} budget.`
  const unit = oneWay ? 'day' : 'night'
  if (estimate.maxDays < 1) return `With €${budget}: the flight, but not even one ${unit} of stay in ${placeName}.`
  const shown = estimate.maxDays > 60 ? '60+' : String(estimate.maxDays)
  return `With €${budget}: up to ${shown} ${unit}${estimate.maxDays === 1 ? '' : 's'} in ${placeName}.`
}

// ---- reading the settings from an address ----------------------------------------------

/** A whole euro amount from 1 to MAX_BUDGET, or null (= no budget). 0, negatives, text and huge numbers mean "no budget". */
export function parseBudget(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  const whole = Math.round(n)
  return whole >= 1 && whole <= MAX_BUDGET ? whole : null
}

export function parseLevel(raw: string | null | undefined): LevelKey {
  return (LEVEL_KEYS as string[]).includes(raw ?? '') ? (raw as LevelKey) : DEFAULT_LEVEL
}

/** The address pieces for a budget choice: a key is only written when it differs from "off". */
export function budgetParams(budget: number | null, level: LevelKey): Record<'budget' | 'level', string | null> {
  return { budget: budget === null ? null : String(budget), level: level === DEFAULT_LEVEL ? null : level }
}

export function levelLabel(level: LevelKey): string {
  return LEVELS[level].label
}

// ---- Anywhere: grouping a list by budget -----------------------------------------------

export type DestinationCostsResponse = {
  /** Every destination we have cost numbers for, by airport/city code (ROM, LIS ...). */
  destinations: Record<string, DestCosts & { name: string }>
}

/** Splits a list of trips with estimates into: within budget (cheapest total first), over budget
 * (cheapest total first) and no cost data (cheapest flight first). Items keep their relative order
 * otherwise. */
export function groupByBudget<T>(items: T[], estimateOf: (item: T) => TripEstimate) {
  const sorted = [...items].sort((a, b) => compareEstimates(estimateOf(a), estimateOf(b)))
  return {
    within: sorted.filter((item) => estimateOf(item).status === 'within'),
    over: sorted.filter((item) => estimateOf(item).status === 'over'),
    nodata: sorted.filter((item) => estimateOf(item).status === 'nodata'),
  }
}

/** Nights between the two flights of an Anywhere trip (a one-way trip has none: it counts as 1 day). */
export function tripNights(trip: { outbound: { date: string }; inbound: { date: string } | null }): number {
  return trip.inbound ? nightsBetweenDates(trip.outbound.date, trip.inbound.date) : 1
}
