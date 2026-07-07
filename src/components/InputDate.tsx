// Hooks come from the jsx-runtime indirection (configurable via `configure()`),
// not a hard `react` import — same rule as RadioGroup / Select. InputDate is a
// *composed* component: an editable <Input> that accepts free text and resolves
// it to an ISO date on commit, plus a <Menu> holding a <Calendar> that opens from
// the trailing button. There is no `a-inputdate` element; the wrapper is the
// coordinator (like Select).
import { useState } from '../jsx-runtime'
import type { BaseProps } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import { parseISODate, parseDateInput, formatDateInput, dateFormatPattern } from '../calendar-core'
import { Input } from './Input'
import { Menu } from './Menu'
import { Calendar } from './Calendar'
import { Button } from './Button'
import { Icon } from './Icon'

/** Snapshot passed as the 2nd argument to `onValueChange` — the new ISO date
 *  (`''` when cleared) plus the field name (mirrors `Input` / `Calendar`). */
export interface InputDateChangeAttrs {
  value: string
  name?: string
}

/** `<InputDate>` props — `Calendar`'s date surface plus `Input`'s field surface. */
export interface InputDateProps extends Omit<BaseProps, 'children'> {
  /** Controlled value — ISO `YYYY-MM-DD` (`''` for empty). Pair with `onValueChange`;
   *  the field and calendar follow it and a pick only *requests* a change. */
  value?: string
  /** Initial value for the uncontrolled case (ISO `YYYY-MM-DD`). */
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
  /** Field size.
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
   *  @defaultValue the locale's format mask (e.g. `MM/DD/YYYY`) */
  placeholder?: string
  /** Validation/feedback tone. An unrecognized entry forces `critical` until fixed.
   *  @defaultValue neutral */
  status?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
  /** Round the field corners — `true` for fully round, or a number / CSS length. */
  round?: boolean | number | string
  /** Show a clear button once the field has a value. */
  clearable?: boolean
  /** Leading icon at the start of the field. */
  icon?: IconShape
  /** Fired after the value resolves (a recognized typed date, a calendar pick, or a
   *  clear), with the new ISO value (`''` when cleared) and a `{ value, name }`
   *  snapshot. An unrecognized entry does not fire it. */
  onValueChange?: (value: string, attrs: InputDateChangeAttrs) => void
}

/**
 * `<InputDate>` — a date field that replaces the native `type="date"` input,
 * **composed** from `Input` + `Menu` + `Calendar` (no `a-inputdate` element; the
 * wrapper is the coordinator). The field accepts free text and resolves it on
 * commit (blur / Enter): a lenient parser reads the locale's order (`06/07/2026`
 * is June 7 in en-US, July 6 in de-DE), month names, and run-together digits, then
 * rewrites the entry to the canonical format. An unrecognized entry marks the field
 * `critical` and leaves the text for the user to fix. The trailing calendar button
 * opens a `Calendar` in a menu; picking a day fills the field. The value is an ISO
 * `YYYY-MM-DD` string.
 *
 * Controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`).
 * Requires `@antadesign/anta/elements` (client-side only).
 *
 * @example
 * ```tsx
 * <InputDate label="Due date" defaultValue="2026-06-15" onValueChange={(v) => save(v)} />
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
  onValueChange,
  className,
  style,
  ...rest
}: InputDateProps) => {
  const resolvedLocale =
    locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
  const minD = parseISODate(min)
  const maxD = parseISODate(max)
  const pattern = placeholder ?? dateFormatPattern(resolvedLocale)

  // Format an ISO value to the field's display string ('' when empty/invalid).
  const fmt = (iso: string | undefined): string => {
    const d = parseISODate(iso ?? null)
    return d ? formatDateInput(d, resolvedLocale) : ''
  }

  const controlled = value !== undefined
  // Uncontrolled committed value lives here; `current` is the effective ISO value.
  const [internal, setInternal] = useState<string | undefined>(defaultValue)
  const current = controlled ? value : internal
  // `text` is what the field shows — a live draft while typing, canonicalized on
  // commit. `open` drives the calendar menu; `invalid` flags an unrecognized entry.
  const [text, setText] = useState<string>(() => fmt(current))
  const [open, setOpen] = useState(false)
  const [invalid, setInvalid] = useState(false)

  // Reformat the field when the committed value changes from outside typing — a
  // calendar pick, a controlled `value` update, or an accepted commit (React's
  // "adjust state when a prop changes" pattern, guarded so it can't loop). A typed
  // entry the consumer *rejects* leaves `current` unchanged, so the text stays put.
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

  // Resolve the field's raw text on commit (blur / Enter): recognize → canonicalize
  // + commit; empty → clear; unrecognized → mark invalid and keep the text.
  const resolve = (raw: string) => {
    const t = raw.trim()
    if (!t) {
      setInvalid(false)
      if (current) commit('')
      else setText('')
      return
    }
    const d = parseDateInput(t, resolvedLocale, { min: minD, max: maxD })
    if (!d) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    const iso = d.toString()
    // Same value re-typed loosely ("6/15/2026") → just canonicalize the text (no
    // value change, so the reformat sync won't fire). Otherwise commit and let the
    // sync reformat once `current` updates.
    if (iso === (current ?? '')) setText(formatDateInput(d, resolvedLocale))
    else commit(iso)
  }

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
        leading={icon ? <Icon shape={icon} /> : undefined}
        value={text}
        placeholder={pattern}
        inputMode="numeric"
        autoComplete="off"
        // Live draft on each keystroke; clear the invalid flag as they re-type.
        onInput={(e: any) => {
          setText(e.currentTarget.value)
          if (invalid) setInvalid(false)
        }}
        // `onChange` is Input's commit event (blur / Enter) — resolve the raw value
        // then, not per keystroke. Read it off the event, not `text` state, to avoid
        // a stale read.
        onChange={(e: any) => resolve(e.currentTarget.value)}
        className={className}
        style={style}
        trailing={
          <>
            <Button
              priority="tertiary"
              size={size}
              icon="calendar-days"
              aria-label="Open calendar"
              aria-haspopup="dialog"
              disabled={disabled}
            />
            {/* Anchors to its previous sibling (the button), so only the button opens
                it — a click in the field just types. Controlled so a day pick can
                close it. `bottom-end` right-aligns the calendar under the field edge. */}
            <Menu
              open={open}
              placement="bottom-end"
              onStateChange={(_e, { next }) => setOpen(next)}
            >
              {/* `data-menu-open` keeps the menu open through calendar interactions
                  (month nav, the year/month jump); a day pick closes it explicitly. */}
              <div data-menu-open="">
                <Calendar
                  value={current || undefined}
                  min={min}
                  max={max}
                  locale={locale}
                  size={size}
                  disabled={disabled}
                  onStateChange={(_e, { next, reason }) => {
                    if (reason !== 'user') return
                    const iso = next ?? ''
                    if (iso === (current ?? '')) setText(fmt(iso))
                    else commit(iso)
                    setInvalid(false)
                    setOpen(false)
                  }}
                />
              </div>
            </Menu>
          </>
        }
        {...rest}
      />
      {/* Submit the ISO value under `name` (the field itself shows locale text). */}
      {name ? <input type="hidden" name={name} value={current ?? ''} /> : null}
    </>
  )
}
