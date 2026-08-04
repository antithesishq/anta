import cn from "clsx"
import { Temporal } from "temporal-polyfill"
import { useId, useMemo, useState } from "../jsx-runtime"
import { nativeStateChange } from "../anta_helpers"
import { Button } from "./Button"
import { Menu } from "./Menu"
import { MenuItem } from "./MenuItem"
import { Tooltip } from "./Tooltip"
import { buildMonth, clampDate, parseISODate } from "../calendar-core"
import type { BaseProps } from "../general_types"

type StateReason = "user" | "reset" | "restore"
type StateDetail = { next: string | null; prev: string | null; reason: StateReason }
type StateChangeEvent = CustomEvent<StateDetail>

/** Snapshot passed as the 2nd argument to `onValueChange` — the new ISO date plus
 *  the field name (mirrors `Input` / `RadioGroup`). */
export interface CalendarChangeAttrs {
  value: string | null
  name?: string
}

/** Public props for `<Calendar>` — the single-date month grid. */
export interface CalendarProps extends Omit<BaseProps, "children" | "onChange"> {
  /** Controlled selected date — ISO `YYYY-MM-DD`. When provided, the application
   *  controls selection: the grid follows this prop and a pick only *requests* a change via
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
  /** Move keyboard focus onto the active day. Change this to a new value (e.g.
   *  increment a counter) to focus the cursor cell — `InputDate` bumps it when
   *  the calendar is opened from the field by keyboard (ArrowDown), so focus
   *  lands in the grid. The initial value never focuses; only a change does. */
  focusSignal?: number
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
  /** Like `onChange`, but with a `{ value, name }` snapshot as the second argument,
   *  matching `Input`. */
  onValueChange?: (event: Event, attrs: CalendarChangeAttrs) => void
}

/**
 * `<Calendar>` is a single-date month grid. It uses Anta components in light DOM.
 * Days and the previous/next chevrons are `<Button>`s, so they use the design
 * system's button states. A selected day is a `tertiary` Button in its `selected`
 * state, using the `brand` tone so the active date uses the brand color.
 * All date math runs on the Temporal engine
 * (`@antadesign/anta` exports `buildMonth` & friends), and the value is an ISO
 * `YYYY-MM-DD` string.
 *
 * The grid lives in a form-associated `<a-calendar>` element, which manages the
 * submitted value, reset, and restore. The wrapper manages view month, selection,
 * keyboard, and roving `tabindex`. The month switcher
 * is a sibling rendered *outside* the grid, so it can be extended (month/year
 * pickers) independently.
 *
 * Controlled (`value` + `onStateChange`) or uncontrolled (`defaultValue`).
 * Requires `@antadesign/anta/elements` (client-side only).
 *
 * @remarks Not SSR-safe. It reads the current date (`Temporal.Now`) and locale
 * (`navigator.language`) at render, so a server render and the client render
 * disagree on the highlighted "today" and on localized labels, causing a
 * hydration mismatch. Render it client-side only (Astro `client:only`, or a
 * dynamic import inside `useEffect`).
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
  focusSignal,
  onStateChange,
  onChange,
  onValueChange,
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
  // A controlled `value` change moves the visible month to it (adjust-state-during-
  // render, guarded so it fires only on a real value change — an unrelated re-render,
  // e.g. an InputDate keystroke, never yanks a manually-navigated view back). This is
  // what lets InputDate preview a typed date's month. A cleared value ('') leaves the
  // view put; uncontrolled calendars never enter here (`value` stays undefined).
  const [lastSyncedValue, setLastSyncedValue] = useState(value)
  // Resolve the target month synchronously into a local: `setCursor` only *schedules* the
  // update, so `cursor` stays stale this render — reading it below (for the grid and the
  // focus request) would capture the previous month if `value` and `focusSignal` both
  // change in one render. `effectiveCursor` reflects the new value immediately.
  let effectiveCursor = cursor
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value)
    const d = parseISODate(value)
    if (d) {
      effectiveCursor = clampDate(d, minD, maxD)
      setCursor(effectiveCursor)
    }
  }
  // Focus signal handed to the element after a keyboard move ("<iso>#<nonce>").
  const [focusReq, setFocusReq] = useState<{ iso: string; n: number } | null>(null)
  // The year/month jump menu is controlled so a month pick closes *only* it, not
  // an ancestor popover it may be nested in (e.g. inside `InputDate`'s menu). A
  // month row also carries `data-menu-open`, so activating it never triggers the
  // shared open-stack's closeSystem — we dismiss the jump menu here instead.
  const [jumpOpen, setJumpOpen] = useState(false)

  const headingId = useId()
  const month = buildMonth({ anchor: effectiveCursor, locale: resolvedLocale, min: minD, max: maxD, selected, today })
  const cursorIso = effectiveCursor.toString()

  // Focus the cursor day when `focusSignal` changes — an external "step into the
  // grid" request (InputDate bumps it on a keyboard open). React's adjust-state-
  // during-render, guarded so only a change fires it; the signal value doubles as
  // the `data-focus` nonce, so a repeat request on the same day still re-focuses.
  const [lastFocusSignal, setLastFocusSignal] = useState(focusSignal)
  if (focusSignal !== lastFocusSignal) {
    setLastFocusSignal(focusSignal)
    if (focusSignal !== undefined) setFocusReq({ iso: cursorIso, n: focusSignal })
  }

  // Years for the heading menu — spanning min..max, defaulting to today ±3 years
  // when unbounded (a short list that fits without scrolling; a bound `min`/`max`
  // widens or narrows it). Each year is a submenu of its twelve months.
  const minYear = minD ? minD.year : today.year - 3
  const maxYear = maxD ? maxD.year : today.year + 3
  const years: number[] = []
  for (let y = minYear; y <= maxYear; y++) years.push(y)

  // Localized month names (year-independent — any year serves). "long" full names
  // for the flyout rows. Memoized on locale — the parent re-renders the calendar
  // on unrelated changes (e.g. each `<InputDate>` keystroke) and these localized
  // names never change unless the locale does.
  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        Temporal.PlainDate.from({ year: 2000, month: i + 1, day: 1 }).toLocaleString(resolvedLocale, {
          month: "long",
        }),
      ),
    [resolvedLocale],
  )
  // A month is unreachable when it lies entirely before `min` or after `max`
  // (partial months keep some selectable days, so they stay enabled).
  const monthOutOfRange = (y: number, m: number) =>
    (minD != null && (y < minD.year || (y === minD.year && m < minD.month))) ||
    (maxD != null && (y > maxD.year || (y === maxD.year && m > maxD.month)))

  // Month switcher — chevrons keep focus (mouse), so no focus signal.
  const moveCursorByMonth = (delta: number) => {
    if (disabled) return
    setCursor((c) => clampDate(c.add({ months: delta }), minD, maxD))
  }
  // Month picked from the heading flyout — jump the view to that year + month,
  // keeping the day (clamped). Navigation only; it doesn't change the selection.
  const pickMonth = (y: number, m: number) => {
    if (disabled) return
    setCursor((c) => clampDate(c.with({ year: y, month: m }), minD, maxD))
  }
  // The year/month jump tree — up to 84 `MenuItem`s. Memoized so the parent
  // re-rendering the calendar on unrelated changes (each `<InputDate>` keystroke)
  // doesn't rebuild the whole subtree; it only recomputes when the highlighted
  // month, the reachable range, or the locale changes. A single reachable year
  // skips the year level and lists its months directly.
  const jumpItems = useMemo(() => {
    // One month row (`i` is 0-based): highlights the shown month (tint + a trailing
    // dot, matching the active-year marker) and disables months outside `min`…`max`.
    const monthItem = (y: number, i: number) => {
      const m = i + 1
      const isCurrent = y === cursor.year && m === cursor.month
      return (
        <MenuItem
          key={`${y}-${m}`}
          label={monthNames[i]}
          selected={isCurrent}
          disabled={monthOutOfRange(y, m) || undefined}
          data-menu-open=""
          onSelect={() => {
            pickMonth(y, m)
            setJumpOpen(false)
          }}
        >
          {isCurrent && <span className="jump-dot" aria-hidden="true" />}
        </MenuItem>
      )
    }
    return years.length === 1
      ? monthNames.map((_, i) => monthItem(years[0], i))
      : years.map((y) => (
          <MenuItem key={y} submenu label={String(y)} selected={y === cursor.year}>
            {y === cursor.year && <span className="jump-dot" aria-hidden="true" />}
            <Menu>{monthNames.map((_, i) => monthItem(y, i))}</Menu>
          </MenuItem>
        ))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthNames, cursor.year, cursor.month, minYear, maxYear, min, max, disabled])

  // The `<a-calendar>` element is the interaction authority: it dispatches
  // `statechange` (picks + reset/restore) and `change`. We forward both to the
  // consumer and, in uncontrolled mode, mirror the new selection into render
  // state. The element manages the form value; the wrapper manages the view and
  // roving cursor. A user pick is cancelable, so respect `preventDefault`.
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
    onValueChange?.(e, { value: (e?.target as { value?: string } | null)?.value || null, name })
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
          aria-label={`${month.heading} — choose month and year`}
          // Nothing to jump to when both arrows are dead — that means the whole
          // `min`…`max` range sits inside the shown month, so the jump menu would
          // offer one year with a single enabled month. Disable the trigger too.
          disabled={disabled || (prevDisabled && nextDisabled)}
        >
          {month.heading}
        </Button>
        {/* Jump menu: pick a year (a submenu of its months), then a month — the
            view leaps there. The shown year/month is highlighted so you can see
            where you're jumping from: the active year keeps a tint + a trailing
            dot (its month flyout holds the check), the active month a tint + check. */}
        <Menu placement="bottom" open={jumpOpen} onStateChange={(_e, { next }) => setJumpOpen(next)}>
          {jumpItems}
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
          // its `selected` state toned `brand`, so the active date reads in the
          // brand color. Today (when not selected) is a `secondary` Button — a
          // subtle resting fill that marks it without a custom ring.
          const variant =
            d.today && !d.selected
              ? ({ priority: "secondary" } as const)
              : ({ priority: "tertiary", selected: d.selected, tone: d.selected ? "brand" : undefined } as const)
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
              {d.today && <Tooltip>Today</Tooltip>}
            </Button>
          )
        })}
      </a-calendar>
    </div>
  )
}
