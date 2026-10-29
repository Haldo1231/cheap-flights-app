// The budget feature's settings, all in one place so they are easy to change.
//
// How a trip is estimated (the same maths is used on every screen, see lib/budget.ts):
//   total = flight price (both flights of a round trip, or the one-way flight)
//         + days of stay x cost of one day
//   days of stay = the nights between the two dates (at least 1; a one-way trip counts as 1 day)
//   cost of one day = accommodation + food + transport + other, taken from the destination's
//   own numbers (hostel_avg_price, food_avg_price, transport_avg_price, other_avg_price) and then
//   multiplied for the chosen spending style.
//
// "Middle" is exactly the destination's current estimate (multiplier 1). "Ultra cheap" and "Rich"
// are OUR ASSUMPTIONS, written here as plain multipliers. To change how cheap or how rich a style
// is, change the numbers below; nothing else needs to be touched.

export type LevelKey = 'ultra' | 'middle' | 'rich'

export type CostCategory = 'accommodation' | 'food' | 'transport' | 'other'

export type Level = {
  label: string
  /** What the accommodation line is called in the cost panel at this style. */
  accommodationLabel: string
  /** One sentence in plain language, shown under the style picker. */
  blurb: string
  /** What each category of the destination's estimate is multiplied by. */
  multipliers: Record<CostCategory, number>
}

export const LEVELS: Record<LevelKey, Level> = {
  ultra: {
    label: 'Ultra cheap',
    accommodationLabel: 'Dorm bed / night',
    blurb: 'A dorm bed, street food and groceries, walking or a day pass, and mostly free sights.',
    multipliers: { accommodation: 0.8, food: 0.6, transport: 0.5, other: 0.3 },
  },
  middle: {
    label: 'Middle',
    accommodationLabel: 'Hostel / night',
    blurb: 'The usual estimate: a hostel bed, cafés and simple restaurants, public transport, a few paid sights.',
    multipliers: { accommodation: 1, food: 1, transport: 1, other: 1 },
  },
  rich: {
    label: 'Rich',
    accommodationLabel: 'Hotel / night',
    blurb: 'A private room or hotel, restaurants every day, taxis and paid sights.',
    multipliers: { accommodation: 3, food: 2.5, transport: 3, other: 3 },
  },
}

export const LEVEL_KEYS = Object.keys(LEVELS) as LevelKey[]
export const DEFAULT_LEVEL: LevelKey = 'middle'

/** Quick choices next to the budget field (euro). */
export const BUDGET_CHIPS = [150, 300, 500, 1000]

/** The biggest budget we accept (a larger number in a hand-edited address is ignored). */
export const MAX_BUDGET = 99999

/** What the estimate covers, shown in the cost panel. */
export const INCLUDED = ['Flights (both ways for a round trip)', 'A place to sleep', 'Food', 'Local transport', 'Small extras']
export const NOT_INCLUDED = ['Activities and tours', 'Shopping', 'Travel insurance', 'Bag and seat fees', 'Getting to your home airport']

/** The URL keys the budget feature uses. They stay out of the price requests (they do not change prices). */
export const BUDGET_KEYS = ['budget', 'level', 'within'] as const
