import cn from "clsx"
import { Temporal } from "temporal-polyfill"
import { useId, useState } from "../jsx-runtime"
import { nativeStateChange } from "../anta_helpers"
import { Button } from "./Button"
import { Menu } from "./Menu"
import { MenuItem } from "./MenuItem"
import { buildMonth, clampDate, parseISODate } from "../calendar-core"
import type { BaseProps } from "../general_types"

type StateReason = "user" | "reset" | "restore"
type StateDetail = { next: string | null; prev: string | null; reason: StateReason }
type StateChangeEvent = CustomEvent<StateDetail>

/** Snapshot passed as the 2nd argument to `onAnyChange` — the new ISO date plus
 *  the field name (mirrors `Input` / `RadioGroup`). */
export interface CalendarChangeAttrs {
  value: string | null
  name?: string
}

/** Public props for `<Calendar>` — the single-date month grid. */
export interface CalendarProps extends Omit<BaseProps, "children" | "onChange"> {
  /** Controlled selected date — ISO `YYYY-MM-DD`. When provided, the consumer owns
   *  selection: the grid follows this prop and a pick only *requests* a change via
   *  `onStateChange`. Leave undefined for uncontrolled. */
  value?: string
  /** Initial selected date for the uncontrolled case (ISO `YYYY-MM-DD`). */
  defaultValue?: string
  /** Earliest selectable date (ISO `YYYY-MM-DD`) — earlier days render disabled. */
  min?: string
  /** Latest selectable date (ISO `YYYY-MM-DD`) — later days render disabled. */
  max?: string
  /** BCP-47 locale tag driving first-day-of-week, weekday, and month names.
   *  @defaultValue navigator.language */
  locale?: string
  /** Form field name — the selected ISO date submits under this key. */
  name?: string
  /** Size of the whole calendar — scales the day cells, the chevrons, and the
   *  weekday / month-heading type together (uses Button's `small` / `medium` /
   *  `large` scale).
   *  @defaultValue 'medium' */
  size?: "small" | "medium" | "large"
  /** Disable the whole calendar (not focusable or selectable). */
  disabled?: boolean
  /** Accessible name for the grid (defaults to the visible month heading). */
  "aria-label"?: string
  /** Fired whenever the selection changes — event-first. `detail` is
   *  `{ next, prev, reason }`: `next` / `prev` are ISO date strings (`null` = none);
   *  `reason` is `'user'` | `'reset'` | `'restore'`. A `'user'` pick fires *before*
   *  applying and is **cancelable** — `event.preventDefault()` vetoes it
   *  (uncontrolled), or in controlled mode answer by updating `value`. `'reset'` /
   *  `'restore'` are not cancelable. */
  onStateChange?: (event: StateChangeEvent, detail: StateDetail) => void
  /** Fired *after* the selection changes (post-apply). Not cancelable; for a
   *  controlled calendar it fires once you've updated `value`. */
  onChange?: (event: Event) => void
  /** Like `onChange`, but with a `{ value, name }` snapshot — the ergonomic
   *  "just give me the new date" callback (mirrors `Input`). */
  onAnyChange?: (event: Event, attrs: CalendarChangeAttrs) => void
}

/**
 * `<Calendar>` — a single-date month grid you pick a day from, **composed from
 * Anta components in light DOM** (nothing is hidden in a shadow root): days and
 * the prev/next chevrons are `<Button>`s, so they inherit the design system's
 * states for free — a selected day is literally a `secondary` Button in its
 * `selected` state. All date math runs on the Temporal engine
 * (`@antadesign/anta` exports `buildMonth` & friends), and the value is an ISO
 * `YYYY-MM-DD` string.
 *
 * The grid lives in a form-associated `<a-calendar>` element (which owns the
 * submitted value + reset/restore); the wrapper owns view-month, selection,
 * keyboard, and roving `tabindex` — the `RadioGroup` model. The month switcher
 * is a sibling rendered *outside* the grid, so it can be extended (month/year
 * pickers) independently.
 *
 * Controlled (`value` + `onStateChange`) or uncontrolled (`defaultValue`).
 * Requires `@antadesign/anta/elements` (client-side only).
 */
export const Calendar = ({
  value,
  defaultValue,
  min,
  max,
  locale,
  name,
  size,
  disabled,
  onStateChange,
  onChange,
  onAnyChange,
  className,
  style,
  "aria-label": ariaLabel,
  ...rest
}: CalendarProps) => {
  const controlled = value !== undefined
  const resolvedLocale =
    locale || (typeof navigator !== "undefined" ? navigator.language : "en-US")
  const minD = parseISODate(min)
  const maxD = parseISODate(max)
  const today = Temporal.Now.plainDateISO()

  // Uncontrolled selection lives here so the wrapper can render the `selected`
  // Button; controlled selection comes from `value`.
  const [internalSelected, setInternalSelected] = useState<Temporal.PlainDate | null>(() =>
    parseISODate(defaultValue),
  )
  const selected = controlled ? parseISODate(value) : internalSelected

  // The cursor anchors the displayed month and the roving focus.
  const [cursor, setCursor] = useState<Temporal.PlainDate>(() =>
    clampDate(parseISODate(value ?? defaultValue) ?? today, minD, maxD),
  )
  // Focus signal handed to the element after a keyboard move ("<iso>#<nonce>").
  const [focusReq, setFocusReq] = useState<{ iso: string; n: number } | null>(null)

  const headingId = useId()
  const month = buildMonth({ anchor: cursor, locale: resolvedLocale, min: minD, max: maxD, selected, today })
  const cursorIso = cursor.toString()

  // Years for the heading menu — spanning min..max (defaulting to ±100 years
  // around today when unbounded). Listed in full, no virtual scroll.
  const minYear = minD ? minD.year : today.year - 100
  const maxYear = maxD ? maxD.year : today.year + 100
  const years: number[] = []
  for (let y = minYear; y <= maxYear; y++) years.push(y)

  // Month switcher — chevrons keep focus (mouse), so no focus signal.
  const moveCursorByMonth = (delta: number) => {
    if (disabled) return
    setCursor((c) => clampDate(c.add({ months: delta }), minD, maxD))
  }
  // Year picked from the heading menu — keep the month/day, change the year.
  const pickYear = (y: number) => {
    if (disabled) return
    setCursor((c) => clampDate(c.with({ year: y }), minD, maxD))
  }

  // The `<a-calendar>` element is the interaction authority: it dispatches
  // `statechange` (picks + reset/restore) and `change`. We forward both to the
  // consumer and, in uncontrolled mode, mirror the new selection into render
  // state (the element owns the form value; the wrapper owns only the visual +
  // the roving cursor). A user pick is cancelable — respect `preventDefault`.
  const onElementStateChange = (raw: StateChangeEvent) => {
    const { event, detail } = nativeStateChange<StateDetail>(raw)
    if (!detail) return
    onStateChange?.(event, detail)
    if (detail.reason === "user" && (controlled || event.defaultPrevented)) return
    const next = parseISODate(detail.next)
    if (!controlled) setInternalSelected(next)
    setCursor(clampDate(next ?? cursor, minD, maxD)) // move the roving cursor to the pick
  }

  const onElementChange = (raw: Event) => {
    const e = "nativeEvent" in raw ? (raw as any).nativeEvent : raw
    onChange?.(e)
    onAnyChange?.(e, { value: (e?.target as { value?: string } | null)?.value || null, name })
  }

  // Keyboard navigation is owned by the `<a-calendar>` element (it focuses cells
  // directly, so it works even where this wrapper isn't hydrated). It emits
  // `navigate` so we can sync the cursor (roving tab stop) and flip the month
  // when the target wasn't in the rendered grid; `data-focus` then lands focus.
  const onNavigate = (raw: CustomEvent<{ date: string }>) => {
    if (disabled) return
    const { detail } = nativeStateChange<{ date: string }>(raw)
    const next = parseISODate(detail?.date ?? null)
    if (!next) return
    const clamped = clampDate(next, minD, maxD)
    setCursor(clamped)
    setFocusReq((p) => ({ iso: clamped.toString(), n: (p?.n ?? 0) + 1 }))
  }

  const prevDisabled =
    disabled ||
    (minD != null && Temporal.PlainDate.compare(cursor.with({ day: 1 }).subtract({ days: 1 }), minD) < 0)
  const nextDisabled =
    disabled ||
    (maxD != null && Temporal.PlainDate.compare(cursor.with({ day: 1 }).add({ months: 1 }), maxD) > 0)

  return (
    <div
      className={cn("anta-calendar", className)}
      data-size={size && size !== "medium" ? size : undefined}
      aria-disabled={disabled ? "true" : undefined}
      style={style}
      {...rest}
    >
      <div data-part="header">
        <Button
          priority="tertiary"
          icon="chevron-left"
          size={size}
          aria-label="Previous month"
          disabled={prevDisabled}
          onClick={() => moveCursorByMonth(-1)}
        />
        <Button
          id={headingId}
          data-part="heading"
          priority="tertiary"
          size={size}
          aria-live="polite"
          aria-label={`${month.heading} — choose year`}
          disabled={disabled}
        >
          {month.heading}
        </Button>
        <Menu placement="bottom">
          {years.map((y) => (
            <MenuItem
              key={y}
              value={y}
              label={String(y)}
              iconTrailing={y === cursor.year ? "check" : undefined}
              onSelect={() => pickYear(y)}
            />
          ))}
        </Menu>
        <Button
          priority="tertiary"
          icon="chevron-right"
          size={size}
          aria-label="Next month"
          disabled={nextDisabled}
          onClick={() => moveCursorByMonth(1)}
        />
      </div>

      <a-calendar
        role="group"
        aria-labelledby={headingId}
        aria-label={ariaLabel}
        name={name}
        // Controlled → drive the element's `value` (and it only *requests* picks);
        // uncontrolled → seed `defaultvalue` and let the element own selection.
        value={controlled ? value : undefined}
        defaultvalue={!controlled ? defaultValue : undefined}
        disabled={disabled ? "" : undefined}
        data-focus={focusReq ? `${focusReq.iso}#${focusReq.n}` : undefined}
        onstatechange={onElementStateChange}
        onchange={onElementChange}
        onnavigate={onNavigate}
      >
        {/* A flat 7-column grid: seven weekday headers (decorative — each day
            button names its own weekday), then the day cells as direct children. */}
        {month.weekdays.map((w, i) => (
          <span
            key={`wd${i}`}
            data-part="weekday"
            data-weekend={w.weekend ? "" : undefined}
            aria-hidden="true"
          >
            {w.narrow}
          </span>
        ))}
        {month.weeks.flat().map((d) => {
          // Days are `tertiary` Buttons; the selected one is a tertiary Button in
          // its `selected` state, and today (when not selected) is a `secondary`
          // Button — a subtle resting fill that marks it without a custom ring.
          const variant =
            d.today && !d.selected
              ? ({ priority: "secondary" } as const)
              : ({ priority: "tertiary", selected: d.selected } as const)
          return (
            <Button
              key={d.iso}
              {...variant}
              size={size}
              disabled={disabled || d.disabled}
              tabIndex={d.iso === cursorIso ? 0 : -1}
              aria-label={d.label}
              aria-current={d.today ? "date" : undefined}
              data-part="day-cell"
              data-date={d.iso}
              data-today={d.today ? "" : undefined}
              data-outside={d.outside ? "" : undefined}
            >
              {d.day}
            </Button>
          )
        })}
      </a-calendar>
    </div>
  )
}
