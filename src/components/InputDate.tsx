// Hooks come from the jsx-runtime indirection (configurable via `configure()`),
// not a hard `react` import — same rule as RadioGroup / Select. InputDate is a
// *composed* component: an editable <Input> that accepts free text and resolves
// it to an ISO date (or date-time) on commit, plus a <Menu> holding a <Calendar>
// that opens from the field itself (click or ArrowDown), anchored to it like
// Select. There is no `a-inputdate` element; the wrapper is the coordinator.
import cn from 'clsx'
import { useMemo, useState } from '../jsx-runtime'
import { Temporal } from 'temporal-polyfill'
import type { BaseProps } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import {
  parseISODate,
  parseDateInput,
  formatDateInput,
  dateFormatPattern,
  parseDateTimeInput,
  formatDateTimeInput,
  dateTimeFormatPattern,
  usesHour12,
} from '../calendar-core'
import { Input } from './Input'
import { Menu } from './Menu'
import { Calendar } from './Calendar'
import { Button } from './Button'
import { Icon } from './Icon'
import { InputTime } from './InputTime'
import styles from './InputDate.module.css'

/** Snapshot passed as the 2nd argument to `onValueChange` — the new ISO value
 *  (`''` when cleared) plus the field name (mirrors `Input` / `Calendar`). */
export interface InputDateChangeAttrs {
  value: string
  name?: string
}

/** `<InputDate>` props — `Calendar`'s date surface plus `Input`'s field surface. */
export interface InputDateProps extends Omit<BaseProps, 'children'> {
  /** Controlled value — ISO `YYYY-MM-DD` (or `YYYY-MM-DDTHH:mm` with `time`), `''`
   *  for empty. Pair with `onValueChange`; the field and calendar follow it and a
   *  pick only *requests* a change. */
  value?: string
  /** Initial value for the uncontrolled case. */
  defaultValue?: string
  /** Earliest selectable date (ISO). Earlier days disable, and a typed date before
   *  it stays uncommitted. */
  min?: string
  /** Latest selectable date (ISO). */
  max?: string
  /** BCP-47 locale driving the display format, the placeholder mask, parsing order,
   *  and the calendar.
   *  @defaultValue navigator.language */
  locale?: string
  /** Form field name — the ISO value submits under this key. */
  name?: string
  /** Field size. Also sizes the calendar and the time row.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Disable the field and the calendar. */
  disabled?: boolean
  /** Field label, above the control. */
  label?: React.ReactNode
  /** Helper text under the field. Replaced by a format hint while the entry is
   *  unrecognized. */
  hint?: React.ReactNode
  /** Placeholder shown when empty.
   *  @defaultValue the locale's format mask (e.g. `MM/DD/YYYY`, `MM/DD/YYYY HH:MM` with `time`) */
  placeholder?: string
  /** Validation/feedback tone. An unrecognized entry forces `critical` until fixed.
   *  @defaultValue neutral */
  status?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
  /** Round the field corners — `true` for fully round, or a number / CSS length. */
  round?: boolean | number | string
  /** Show a clear button once the field has a value. */
  clearable?: boolean
  /** Leading icon at the start of the field — the calendar affordance. Pass
   *  another shape to change it, or `false` to drop it.
   *  @defaultValue calendar-days */
  icon?: IconShape | false
  /** Include a time. The value becomes ISO `YYYY-MM-DDTHH:mm`, the field parses a
   *  trailing time after a space (`06/15/2026 14:30`, `… 2:30pm`), and the menu
   *  shows a time row (hours : minutes, an AM/PM toggle in 12-hour locales, then a
   *  Done button) under the calendar. Picking a day keeps the menu open so you can
   *  set the time. */
  time?: boolean
  /** Force the time cycle when `time` is on: `true` for 12-hour (AM/PM), `false`
   *  for 24-hour. Omit to follow the locale (`en-US` → 12-hour, most others → 24). */
  hour12?: boolean
  /** Fired after the value resolves (a recognized entry, a calendar pick, a time
   *  change, or a clear), with the new ISO value (`''` when cleared) and a
   *  `{ value, name }` snapshot. An unrecognized entry does not fire it. */
  onValueChange?: (value: string, attrs: InputDateChangeAttrs) => void
}

/**
 * `<InputDate>` — a date (or date-time) field that replaces the native
 * `type="date"` / `type="datetime-local"` input, **composed** from `Input` +
 * `Menu` + `Calendar` (no `a-inputdate` element; the wrapper is the coordinator).
 * The field accepts free text and resolves it on commit (blur / Enter) with a
 * lenient, locale-aware parser, then rewrites the entry to the canonical format;
 * an unrecognized entry marks the field `critical` and keeps the text. Clicking the
 * field (or pressing ArrowDown) opens a `Calendar` in a menu; a leading calendar
 * icon marks the affordance. Mouse-open keeps focus in the field so you can keep
 * typing; ArrowDown moves focus into the grid. With `time`, a time row sits under
 * the grid. The value is an ISO `YYYY-MM-DD` string, or `YYYY-MM-DDTHH:mm` with `time`.
 *
 * Controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`).
 * Requires `@antadesign/anta/elements` (client-side only).
 *
 * @remarks Not SSR-safe (it embeds `Calendar`): it reads the current date
 * (`Temporal.Now`) and locale (`navigator.language`) at render, so server and
 * client output diverge and hydration mismatches. Render it client-side only.
 *
 * @example
 * ```tsx
 * <InputDate label="Starts" time defaultValue="2026-06-15T09:00" onValueChange={(v) => save(v)} />
 * ```
 */
export const InputDate = ({
  value,
  defaultValue,
  min,
  max,
  locale,
  name,
  size,
  disabled,
  label,
  hint,
  placeholder,
  status,
  round,
  clearable,
  icon,
  time,
  hour12,
  onValueChange,
  className,
  style,
  ...rest
}: InputDateProps) => {
  const resolvedLocale =
    locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
  const minD = parseISODate(min)
  const maxD = parseISODate(max)
  // 12-hour (AM/PM) vs 24-hour, following the locale unless `hour12` overrides.
  const twelveHour = time ? (hour12 ?? usesHour12(resolvedLocale)) : false
  // The placeholder mask is constant for a locale + cycle, so derive it once
  // rather than rebuilding an `Intl.DateTimeFormat` on every keystroke's render.
  const pattern = useMemo(
    () =>
      placeholder ??
      (time ? dateTimeFormatPattern(resolvedLocale, twelveHour) : dateFormatPattern(resolvedLocale)),
    [placeholder, time, resolvedLocale, twelveHour],
  )

  // Format an ISO value to the field's display string ('' when empty/invalid).
  const fmt = (iso: string | undefined): string => {
    if (!iso) return ''
    const d = parseISODate(iso.slice(0, 10))
    if (!d) return ''
    if (!time) return formatDateInput(d, resolvedLocale)
    const hasT = iso.length >= 16 && iso[10] === 'T'
    const dt = d.toPlainDateTime(Temporal.PlainTime.from(hasT ? iso.slice(11, 16) : '00:00'))
    return formatDateTimeInput(dt, resolvedLocale, twelveHour)
  }
  // Normalize an initial ISO for `time` mode (a bare date gains midnight, seconds
  // are dropped) so the stored value is always minute-precise date-time.
  const normalize = (iso: string | undefined): string | undefined =>
    !iso || !time ? iso : iso.length <= 10 ? `${iso}T00:00` : iso.slice(0, 16)

  const controlled = value !== undefined
  // Uncontrolled committed value lives here; `current` is the effective ISO value.
  const [internal, setInternal] = useState<string | undefined>(() => normalize(defaultValue))
  const current = controlled ? value : internal
  const dateISO = current ? current.slice(0, 10) : ''
  const hasTime = !!current && current.length >= 16 && current[10] === 'T'
  const h24 = hasTime ? parseInt(current!.slice(11, 13), 10) || 0 : 0
  const curM = hasTime ? current!.slice(14, 16) : '00'

  // `text` is what the field shows — a live draft while typing, canonicalized on
  // commit. `open` drives the calendar menu; `invalid` flags an unrecognized entry.
  const [text, setText] = useState<string>(() => fmt(current))
  const [open, setOpen] = useState(false)
  const [invalid, setInvalid] = useState(false)
  // Bumped to move focus into the calendar grid on a keyboard open (ArrowDown) —
  // fed to `Calendar`'s `focusSignal`, which drives `<a-calendar>`'s `data-focus`.
  const [focusNonce, setFocusNonce] = useState(0)

  // Reformat the field when the committed value changes from outside typing — a
  // calendar pick, a controlled `value` update, or an accepted commit (React's
  // "adjust state when a prop changes" pattern, guarded so it can't loop).
  const [lastValue, setLastValue] = useState(current)
  if (current !== lastValue) {
    setLastValue(current)
    setText(fmt(current))
    setInvalid(false)
  }
  const commit = (iso: string) => {
    if (!controlled) setInternal(iso || undefined)
    onValueChange?.(iso, { value: iso, name })
  }

  // Combine a picked date with the committed time (midnight when none is set yet),
  // so choosing a day in a date-time field keeps the time the `<InputTime>` holds.
  const withTime = (d: string) => `${d}T${String(h24).padStart(2, '0')}:${curM}`

  // Apply a resolved ISO value (typed commit or calendar pick): recanonicalize the
  // field when it already equals the committed value, otherwise commit the change.
  // Clears the invalid flag either way. Shared so both entry points stay in step.
  const apply = (iso: string) => {
    setInvalid(false)
    if (iso === (current ?? '')) setText(fmt(iso))
    else commit(iso)
  }

  // Resolve the field's raw text on commit (blur / Enter): recognize → canonicalize
  // + commit; empty → clear; unrecognized → mark invalid and keep the text. Returns
  // whether the entry resolved (valid or empty) — Enter uses it to decide whether to
  // close the menu (an unrecognized entry keeps it open with the error).
  const resolve = (raw: string): boolean => {
    const t = raw.trim()
    if (!t) {
      setInvalid(false)
      if (current) commit('')
      else setText('')
      return true
    }
    const parsed = time
      ? parseDateTimeInput(t, resolvedLocale, { min: minD, max: maxD })
      : parseDateInput(t, resolvedLocale, { min: minD, max: maxD })
    if (!parsed) {
      setInvalid(true)
      return false
    }
    const iso = time
      ? (parsed as Temporal.PlainDateTime).toString({ smallestUnit: 'minute' })
      : parsed.toString()
    apply(iso)
    return true
  }

  // Parse the live draft to the date the calendar should preview (jump month + highlight).
  // Empty text tracks the committed date; a non-empty draft that doesn't (yet) parse or is
  // out of range yields `null`. Previewing never commits — the value only changes on Enter /
  // blur / a calendar pick. `min`/`max` are the memo deps (not the recreated `minD`/`maxD`
  // objects) so it's stable across keystrokes.
  const parsedPreview = useMemo(() => {
    const t = text.trim()
    if (!t) return dateISO
    const parsed = time
      ? parseDateTimeInput(t, resolvedLocale, { min: minD, max: maxD })
      : parseDateInput(t, resolvedLocale, { min: minD, max: maxD })
    return parsed ? parsed.toString().slice(0, 10) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, time, resolvedLocale, dateISO, min, max])

  // Hold the last resolvable preview so an intermediate unparseable keystroke (e.g. midway
  // through typing a date in another month) doesn't snap the calendar back to the committed
  // month and flicker. Only advance when the draft resolves; unparseable keeps the last view.
  const [previewISO, setPreviewISO] = useState(dateISO)
  if (parsedPreview !== null && parsedPreview !== previewISO) setPreviewISO(parsedPreview)

  return (
    <>
      <Input
        label={label}
        hint={invalid ? `Unrecognized date. Try ${pattern}.` : hint}
        status={invalid ? 'critical' : status}
        size={size}
        round={round}
        disabled={disabled}
        clearable={clearable}
        leading={icon === false ? undefined : <Icon shape={icon ?? 'calendar-days'} />}
        value={text}
        placeholder={pattern}
        inputMode={time ? 'text' : 'numeric'}
        autoComplete="off"
        aria-haspopup="dialog"
        aria-expanded={open ? 'true' : 'false'}
        onInput={(e: any) => {
          setText(e.currentTarget.value)
          if (invalid) setInvalid(false)
        }}
        onChange={(e: any) => resolve(e.currentTarget.value)}
        onKeyDown={(e: any) => {
          // ArrowDown is the deliberate "enter the grid" gesture. <a-menu> opens
          // itself on ArrowDown (its anchor keydown, since this editable field
          // synthesizes no click of its own), so here we only step focus into the
          // grid via `focusSignal` (bumped below). Enter stays "commit the typed
          // date", so it isn't overloaded. Once inside, <a-calendar> owns the
          // arrows, so this only runs while focus is in the field.
          if (e.key === 'ArrowDown' && !disabled) {
            e.preventDefault()
            setFocusNonce((n) => n + 1)
          }
          // Enter commits the typed date (blur's `change` doesn't fire on Enter for a
          // standalone input). A resolved entry closes the menu; an unrecognized one
          // keeps it open with the error so the user can fix it or pick a day.
          if (e.key === 'Enter' && !disabled) {
            e.preventDefault()
            if (resolve(e.currentTarget.value)) setOpen(false)
          }
        }}
        className={cn(styles.dateField, className)}
        style={style}
        {...rest}
      />
      {/* The calendar menu anchors to its previous sibling, the field: a-input's
          getAnchorRect() returns its `.field` box, so a click anywhere in the field
          opens it and never counts as an outside-click dismiss. A mouse open leaves
          focus in the field (type, or click a day); ArrowDown moves focus into the
          grid via `focusSignal`. Controlled so a day pick / Done can close it. */}
      <Menu
        open={open}
        placement="bottom-start"
        autoWidth
        className={styles.calendarMenu}
        onStateChange={(_e, { next }) => setOpen(next)}
      >
        {/* `data-menu-open` keeps the menu open through calendar + time
            interactions; a day pick closes it (date-only) or keeps it open (time),
            and the Done button closes it. */}
        <div data-menu-open="">
          <Calendar
            value={previewISO}
            min={min}
            max={max}
            locale={locale}
            size={size}
            disabled={disabled}
            focusSignal={focusNonce}
            onStateChange={(_e, { next, reason }) => {
              if (reason !== 'user') return
              const d = next ?? ''
              apply(time && d ? withTime(d) : d)
              if (!time) setOpen(false)
            }}
          />
          {time && (
            <div className={styles.timeRow}>
              {/* The time half is the standalone InputTime — a segmented hour /
                  minute / (AM-PM) field. It owns the 12h/24h clock, the AM/PM
                  toggle, and 24h→12h conversion; we just splice its `HH:mm` onto
                  the picked (or today's) date. */}
              <InputTime
                size={size}
                locale={locale}
                hour12={hour12}
                disabled={disabled}
                aria-label="Time"
                value={hasTime ? `${String(h24).padStart(2, '0')}:${curM}` : ''}
                onValueChange={(e: any, { value: t }: { value: string }) => {
                  // Commit on blur only (`change`), not on every segment edit
                  // (`input`) — consistent with the date field, and it keeps the
                  // controlled `value` stable while the user edits so it doesn't
                  // fight them. A cleared / incomplete time (`t === ''`) commits
                  // the date alone (time undefined), so the clear sticks instead
                  // of the stale time reappearing on the next render.
                  const ev = 'nativeEvent' in e ? e.nativeEvent : e
                  if (ev?.type !== 'change') return
                  const base = dateISO || Temporal.Now.plainDateISO().toString()
                  commit(t ? `${base}T${t}` : base)
                }}
              />
              <Button
                priority="tertiary"
                size={size}
                icon="check"
                aria-label="Done"
                onClick={() => setOpen(false)}
              />
            </div>
          )}
        </div>
      </Menu>
      {/* Submit the ISO value under `name` (the field itself shows locale text). */}
      {name ? <input type="hidden" name={name} value={current ?? ''} /> : null}
    </>
  )
}
