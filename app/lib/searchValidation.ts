// Checks the search form before it is sent, with messages in plain language.

export type SearchInput = {
  origins: string[]
  destination: string
  oneWay: boolean
  dateMode: 'exact' | 'month' | 'range'
  departDate: string
  returnDate: string
  month: string
  returnMonth: string
  rangeStart: string
  rangeEnd: string
  minDays: number
  maxDays: number
  outDays: number[]
  backDays: number[]
  minNights: number
  maxNights: number
  /** Today as YYYY-MM-DD (passed in so this stays a pure function). */
  today: string
}

export type SearchErrors = Partial<
  Record<
    'origins' | 'destination' | 'departDate' | 'returnDate' | 'month' | 'returnMonth' | 'outDays' | 'backDays' | 'nights' | 'rangeStart' | 'rangeEnd' | 'days',
    string
  >
>

export const MAX_NIGHTS = 60
export const MAX_RANGE_DAYS = 30

export function validateSearch(s: SearchInput): SearchErrors {
  const errors: SearchErrors = {}

  if (s.origins.length === 0) errors.origins = 'Pick at least one airport to fly from.'
  if (!s.destination) errors.destination = 'Choose where you want to go, or pick Anywhere.'

  if (s.dateMode === 'exact') {
    if (!s.departDate) errors.departDate = 'Pick a departure date.'
    else if (s.departDate < s.today) errors.departDate = 'That date is in the past.'

    if (!s.oneWay && s.returnDate) {
      if (s.returnDate < s.today) errors.returnDate = 'That date is in the past.'
      else if (s.departDate && s.returnDate < s.departDate) errors.returnDate = "The return can't be before the departure."
    }
  }

  if (s.dateMode === 'month') {
    if (!s.month) errors.month = 'Pick a month.'
    if (!s.oneWay && s.month && s.returnMonth && s.returnMonth < s.month) {
      errors.returnMonth = "The return month can't be before the departure month."
    }
    if (s.outDays.length === 0) errors.outDays = 'Pick at least one departure day.'
    if (!s.oneWay) {
      if (s.backDays.length === 0) errors.backDays = 'Pick at least one return day.'
      const okNights =
        Number.isFinite(s.minNights) &&
        Number.isFinite(s.maxNights) &&
        s.minNights >= 1 &&
        s.maxNights >= s.minNights &&
        s.maxNights <= MAX_NIGHTS
      if (!okNights) errors.nights = `Nights must be between 1 and ${MAX_NIGHTS}, and the maximum can't be lower than the minimum.`
    }
  }

  if (s.dateMode === 'range') {
    if (!s.rangeStart) errors.rangeStart = 'Pick a start date.'
    else if (s.rangeStart < s.today) errors.rangeStart = 'That date is in the past.'
    if (!s.rangeEnd) errors.rangeEnd = 'Pick an end date.'
    else if (s.rangeStart && s.rangeEnd < s.rangeStart) errors.rangeEnd = "The end date can't be before the start date."
    if (!s.oneWay) {
      const okDays =
        Number.isFinite(s.minDays) &&
        Number.isFinite(s.maxDays) &&
        s.minDays >= 1 &&
        s.maxDays >= s.minDays &&
        s.maxDays <= MAX_RANGE_DAYS
      if (!okDays) errors.days = `Trip length must be between 1 and ${MAX_RANGE_DAYS} days, and the maximum can't be lower than the minimum.`
    }
    if (s.outDays.length === 0) errors.outDays = 'Pick at least one departure day.'
    if (!s.oneWay && s.backDays.length === 0) errors.backDays = 'Pick at least one return day.'
  }

  return errors
}

/** Today in the user's own calendar as YYYY-MM-DD. */
export function todayString(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
