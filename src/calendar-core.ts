import { Temporal } from 'temporal-polyfill'

/**
 * Calendar engine — pure, framework-agnostic date logic for building a month
 * grid, on the Temporal API. No DOM. This is what *populates* a calendar:
 * `<Calendar>` uses it to render Anta components, and a non-React consumer can
 * use the same functions to drive their own markup (the element provides the
 * grid layout + form association; this provides the data).
 *
 * Published as `@antadesign/anta` named exports.
 */

const cmp = Temporal.PlainDate.compare

/** One day cell in the rendered grid. */
export interface CalendarDay {
  /** The date this cell represents. */
  date: Temporal.PlainDate
  /** ISO `YYYY-MM-DD`. */
  iso: string
  /** Day of month, 1–31. */
  day: number
  /** Day of week, 1 (Mon) – 7 (Sun), matching Temporal. */
  weekday: number
  /** True when the day belongs to an adjacent month (grid spill-over). */
  outside: boolean
  /** True when the day is outside `[min, max]` (not selectable). */
  disabled: boolean
  /** True when the day is the current date. */
  today: boolean
  /** True when the day is the selected date. */
  selected: boolean
  /** Localized full-date label incl. weekday, e.g. "Sunday, June 28, 2026"
   *  (for each day button's `aria-label`, since there's no column-header row). */
  label: string
}

/** A weekday column header, localized. */
export interface CalendarWeekday {
  /** One-letter-ish narrow form (here trimmed to two: "Mo", "Tu", …). */
  narrow: string
  /** Locale short form ("Mon", "lun.", …). */
  short: string
  /** Locale long form ("Monday") — for the column header's accessible name. */
  long: string
  /** Saturday or Sunday (locale-independent — by Temporal `dayOfWeek` 6/7). */
  weekend: boolean
}

/** A fully-computed month: heading, ordered weekday headers, and the week rows. */
export interface CalendarMonth {
  /** Displayed year. */
  year: number
  /** Displayed month, 1–12. */
  month: number
  /** Localized "June 2026" heading. */
  heading: string
  /** Seven weekday headers, ordered from the locale's first day of week. */
  weekdays: CalendarWeekday[]
  /** Week rows (6 by default), each seven `CalendarDay`s. */
  weeks: CalendarDay[][]
}

export interface BuildMonthOptions {
  /** Any date within the month to display. */
  anchor: Temporal.PlainDate
  /** BCP-47 locale. @defaultValue 'en-US' */
  locale?: string
  /** Earliest selectable date (inclusive). */
  min?: Temporal.PlainDate | null
  /** Latest selectable date (inclusive). */
  max?: Temporal.PlainDate | null
  /** The currently-selected date, if any. */
  selected?: Temporal.PlainDate | null
  /** The date to mark as "today". @defaultValue Temporal.Now.plainDateISO() */
  today?: Temporal.PlainDate | null
  /** Number of week rows. @defaultValue 6 */
  weeks?: number
}

/** Parse an ISO `YYYY-MM-DD` string to a `Temporal.PlainDate`, or `null` if
 *  it's empty or malformed. */
export function parseISODate(value: string | null | undefined): Temporal.PlainDate | null {
  if (!value) return null
  try {
    return Temporal.PlainDate.from(value)
  } catch {
    return null
  }
}

/** First weekday for a locale, `1`=Monday … `7`=Sunday (matches Temporal's
 *  `dayOfWeek`). Reads `Intl.Locale#getWeekInfo()` (or the `weekInfo` getter on
 *  engines that expose it that way); falls back to Monday — never hard-codes
 *  Sunday. */
export function firstDayOfWeek(locale: string): number {
  try {
    const loc = new Intl.Locale(locale)
    const info =
      (loc as unknown as { getWeekInfo?: () => { firstDay?: number } }).getWeekInfo?.() ??
      (loc as unknown as { weekInfo?: { firstDay?: number } }).weekInfo
    const fd = info?.firstDay
    if (typeof fd === 'number' && fd >= 1 && fd <= 7) return fd
  } catch {
    /* invalid locale tag — fall through */
  }
  return 1
}

/** Clamp a date into the inclusive `[min, max]` range. */
export function clampDate(
  d: Temporal.PlainDate,
  min?: Temporal.PlainDate | null,
  max?: Temporal.PlainDate | null,
): Temporal.PlainDate {
  if (min && cmp(d, min) < 0) return min
  if (max && cmp(d, max) > 0) return max
  return d
}

/** Whether a date falls outside the inclusive `[min, max]` range. */
export function isOutOfRange(
  d: Temporal.PlainDate,
  min?: Temporal.PlainDate | null,
  max?: Temporal.PlainDate | null,
): boolean {
  return (min != null && cmp(d, min) < 0) || (max != null && cmp(d, max) > 0)
}

const twoLetter = (s: string): string => Array.from(s).slice(0, 2).join('')

/** The seven weekday headers, ordered from the locale's first day of week. */
export function getWeekdays(locale: string, firstDay = firstDayOfWeek(locale)): CalendarWeekday[] {
  // Reference Monday (2021-02-01) rolled to the locale's first weekday.
  const ref = Temporal.PlainDate.from('2021-02-01')
  const start = ref.add({ days: (firstDay - ref.dayOfWeek + 7) % 7 })
  const out: CalendarWeekday[] = []
  for (let i = 0; i < 7; i++) {
    const d = start.add({ days: i })
    const short = d.toLocaleString(locale, { weekday: 'short' })
    out.push({
      short,
      narrow: twoLetter(short),
      long: d.toLocaleString(locale, { weekday: 'long' }),
      weekend: d.dayOfWeek === 6 || d.dayOfWeek === 7,
    })
  }
  return out
}

/** Build a fully-resolved month grid for rendering. */
export function buildMonth(opts: BuildMonthOptions): CalendarMonth {
  const {
    anchor,
    locale = 'en-US',
    min = null,
    max = null,
    selected = null,
    today = Temporal.Now.plainDateISO(),
    weeks = 6,
  } = opts
  const fd = firstDayOfWeek(locale)
  const year = anchor.year
  const month = anchor.month
  const firstOfMonth = anchor.with({ day: 1 })
  const lead = (firstOfMonth.dayOfWeek - fd + 7) % 7
  const start = firstOfMonth.subtract({ days: lead })

  const grid: CalendarDay[][] = []
  for (let w = 0; w < weeks; w++) {
    const row: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      const date = start.add({ days: w * 7 + i })
      row.push({
        date,
        iso: date.toString(),
        day: date.day,
        weekday: date.dayOfWeek,
        outside: date.month !== month || date.year !== year,
        disabled: isOutOfRange(date, min, max),
        today: today != null && cmp(date, today) === 0,
        selected: selected != null && cmp(date, selected) === 0,
        label: date.toLocaleString(locale, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      })
    }
    grid.push(row)
  }

  return {
    year,
    month,
    heading: anchor.toLocaleString(locale, { month: 'long', year: 'numeric' }),
    weekdays: getWeekdays(locale, fd),
    weeks: grid,
  }
}
