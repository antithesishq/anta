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

/* --- Free-text date input: pattern, display, and lenient parse ---
   These back `<InputDate>`, whose field accepts arbitrary text and only
   resolves it on blur. All three read the locale's numeric date format via
   `Intl`, forced to latin digits so the round-trip (parse → format) stays
   deterministic across numbering systems. */

// A fixed reference date whose fields are all unambiguous by position (month
// 06, day 15, year 2026). UTC so the formatter never shifts it a day.
const FMT_SAMPLE = new Date(Date.UTC(2026, 5, 15))
const NUMERIC_DATE: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'UTC',
  numberingSystem: 'latn',
}

/** The locale's numeric date order as `Intl` part types, e.g. `['month','day','year']`
 *  (en-US) or `['day','month','year']` (de-DE). Falls back to ISO order. */
function fieldOrder(locale: string): ('year' | 'month' | 'day')[] {
  try {
    return new Intl.DateTimeFormat(locale, NUMERIC_DATE)
      .formatToParts(FMT_SAMPLE)
      .filter((p) => p.type === 'year' || p.type === 'month' || p.type === 'day')
      .map((p) => p.type as 'year' | 'month' | 'day')
  } catch {
    return ['year', 'month', 'day']
  }
}

/** The placeholder mask for a locale: `MM/DD/YYYY` (en-US), `DD.MM.YYYY` (de-DE),
 *  `YYYY/MM/DD` (ja-JP). Built from the locale's own separators and field order. */
export function dateFormatPattern(locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, NUMERIC_DATE)
      .formatToParts(FMT_SAMPLE)
      .map((p) =>
        p.type === 'year' ? 'YYYY' : p.type === 'month' ? 'MM' : p.type === 'day' ? 'DD' : p.value,
      )
      .join('')
  } catch {
    return 'YYYY-MM-DD'
  }
}

/** A date in the locale's canonical numeric form (2-digit month/day, 4-digit year,
 *  latin digits) — what the field shows once a typed or picked date resolves. */
export function formatDateInput(date: Temporal.PlainDate, locale: string): string {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day))
  return new Intl.DateTimeFormat(locale, NUMERIC_DATE).format(d)
}

/** The month number (1–12) an alpha token names in `locale` (long or short form,
 *  case-insensitive), or `null`. Also matches a 3+ char prefix ("sept" → 9). */
function matchMonthName(text: string, locale: string): number | null {
  const alpha = text.toLowerCase().match(/[^\d\s.,/-]+/g)
  if (!alpha) return null
  const long = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
  const short = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  for (let mo = 1; mo <= 12; mo++) {
    const d = new Date(Date.UTC(2020, mo - 1, 1))
    const l = long.format(d).toLowerCase()
    const s = short.format(d).toLowerCase().replace(/\.$/, '')
    if (alpha.some((a) => a === l || a === s || (a.length >= 3 && l.startsWith(a)))) return mo
  }
  return null
}

/** Options for {@link parseDateInput}. */
export interface ParseDateOptions {
  /** Earliest acceptable date; earlier input resolves to `null`. */
  min?: Temporal.PlainDate | null
  /** Latest acceptable date; later input resolves to `null`. */
  max?: Temporal.PlainDate | null
}

/**
 * Recognize a date from free-form text, or return `null` when it can't. Lenient
 * by design (the field lets you type anything, then resolves on blur):
 *
 * - ISO `YYYY-MM-DD`.
 * - Numbers in any separator, mapped to day/month/year by the locale's order —
 *   `06/07/2026` is June 7 in en-US, July 6 in de-DE.
 * - A month name plus a day and year (`15 Jun 2026`, `June 15 2026`).
 * - Eight run-together digits, split by the locale order (`06152026` en-US).
 * - Two numbers (day + month) take the current year; two-digit years pivot at 70.
 *
 * A real but out-of-`[min, max]` date returns `null` — the value stays uncommitted.
 */
export function parseDateInput(
  text: string,
  locale: string,
  opts: ParseDateOptions = {},
): Temporal.PlainDate | null {
  const accept = (d: Temporal.PlainDate) =>
    isOutOfRange(d, opts.min ?? null, opts.max ?? null) ? null : d

  const s = (text ?? '').trim()
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const iso = parseISODate(s)
    return iso ? accept(iso) : null
  }

  const order = fieldOrder(locale)
  const month = matchMonthName(s, locale)
  const nums = (s.match(/\d+/g) ?? []).map(Number)

  let y: number | undefined
  let m: number | undefined
  let d: number | undefined

  if (month != null) {
    m = month
    if (nums.length === 1) {
      d = nums[0]
      y = Temporal.Now.plainDateISO().year
    } else if (nums.length >= 2) {
      // The 4-digit / >31 number is the year; the other is the day.
      const [a, b] = nums
      if (a > 31) [y, d] = [a, b]
      else if (b > 31) [y, d] = [b, a]
      else [d, y] = [a, b]
    } else return null
  } else if (nums.length === 1) {
    const digits = s.replace(/\D/g, '')
    if (digits.length !== 8) return null
    // Split eight digits by the locale field order (year 4 wide, the rest 2).
    let i = 0
    const seg: Record<string, number> = {}
    for (const f of order) {
      const w = f === 'year' ? 4 : 2
      seg[f] = Number(digits.slice(i, i + w))
      i += w
    }
    ;({ year: y, month: m, day: d } = seg as { year: number; month: number; day: number })
  } else if (nums.length === 2) {
    // Day + month in locale order (year dropped), current year.
    const dm = order.filter((f) => f !== 'year')
    const seg: Record<string, number> = {}
    dm.forEach((f, i) => (seg[f] = nums[i]))
    m = seg.month
    d = seg.day
    y = Temporal.Now.plainDateISO().year
  } else if (nums.length >= 3) {
    const seg: Record<string, number> = {}
    order.forEach((f, i) => (seg[f] = nums[i]))
    y = seg.year
    m = seg.month
    d = seg.day
  } else return null

  if (y != null && y < 100) y = y < 70 ? 2000 + y : 1900 + y

  try {
    return accept(Temporal.PlainDate.from({ year: y!, month: m!, day: d! }, { overflow: 'reject' }))
  } catch {
    return null
  }
}
