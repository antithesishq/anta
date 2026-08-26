import type { BaseProps, DOMEventHandlers } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import { nativeStateChange, toneStyle, roundStyle, roundAttr } from '../anta_helpers'
import { Button } from './Button'
import { Icon } from './Icon'

/** Convenience snapshot passed as the 2nd argument to `onValueChange`. */
export interface InputChangeAttrs {
  /** Current value. */
  value: string
  /** The field's `name` — handy for keyed updates: `s => ({ ...s, [name]: value })`.
   *  The one caller-provided field carried here, for that pattern; read anything
   *  else (`id`, `type`, `className`) off `event.target`. */
  name?: string
  /** `true` when the value is empty. */
  empty: boolean
  /** Whether the field currently passes validation (native + `error`). `undefined`
   *  where `ElementInternals` is unsupported. */
  valid?: boolean
  /** Current validation message (`''` when valid). */
  validationMessage: string
}

export interface InputProps extends BaseProps, DOMEventHandlers {
  /** Extra content rendered directly under the field, above the hint/error (it
   *  pushes the message down). A no-box child like an Anta `<Tooltip>` takes no
   *  space and anchors to the field — consistent with how tooltips attach
   *  to any other element. Use the named `leading` / `trailing` props for
   *  in-field content. */
  children?: React.ReactNode
  /** Field label, shown above the control. A string is rendered with the
   *  label type scale; pass a node for full control. Associated with the
   *  control as its accessible name (the element mirrors the label text to
   *  `aria-label`, since `<label for>` can't cross the shadow boundary). */
  label?: React.ReactNode
  /** Message below the field. Neutral helper text by default; `status` recolors
   *  it and prefixes the matching glyph. */
  hint?: React.ReactNode
  /** Validation / feedback tone — colors the border + `hint` and prefixes a
   *  glyph. Only `critical` marks the field invalid (`aria-invalid`, blocks form
   *  submission, `:state(invalid)`); `success` / `warning` / `info` / `brand`
   *  are advisory and stay valid. Omit (or `neutral`) for a plain field. */
  status?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
  /** Glyph shown before the `hint` when `status` is set. Each status has a
   *  default (critical → `warning-diamond`, warning → `warning-triangle`,
   *  success → `circle-check`, info → `info`, brand → `circle-small-solid`); pass a
   *  shape to override, or `false` to drop it. `neutral` has no default glyph. */
  statusIcon?: IconShape | (string & {}) | false
  /** Custom accent color — any literal CSS color tints the resting + hover
   *  border (focus ring stays the global `--focus-ring`). For consistency with the
   *  other controls' custom-tone knob; a `status` still overrides for validation. */
  tone?: string
  /** Size variant. small=24px, medium=28px, large=32px tall; the type scale and
   *  icon track the size (small 13/16 + 14px icon · medium 15/20 + 16px ·
   *  large 17/22 + 18px).
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Controlled value. Pair with `onChange` / `onInput`. */
  value?: string
  /** Initial value for the uncontrolled case. */
  defaultValue?: string
  /** Render a `<textarea>` instead of an `<input>`. Without `rows` it grows
   *  with its content from one line (capped by `maxRows` if set). Autogrow uses
   *  CSS `field-sizing` where supported (Chrome/Edge, Safari ≥ 26.2) and falls
   *  back to a built-in JS resize elsewhere (Firefox, older Safari), so it grows
   *  in every browser. */
  multiline?: boolean
  /** Fixed visible row count — a constant-height `<textarea>` (implies
   *  `multiline`). */
  rows?: number
  /** Cap the autogrow height (in rows) of a `multiline` field with no `rows`.
   *  Omit for unbounded growth. */
  maxRows?: number
  /** Show a clear button as the first trailing item once the field has a
   *  value. */
  clearable?: boolean
  /** Content pinned to the start of the field (e.g. an icon). */
  leading?: React.ReactNode
  /** Content pinned to the end of the field (e.g. icons, buttons), after the
   *  clear button when `clearable`. */
  trailing?: React.ReactNode
  /** Single-line input type. Ignored when `multiline`. `search` is a
   *  **wrapper-only** shorthand: it defaults a leading search icon and a clear
   *  button (both overridable — pass your own `leading`, or `clearable={false}`)
   *  and sets `inputmode="search"`, but the DOM input stays `type="text"`. The
   *  native `search` type never reaches the element, so the browser's own
   *  clear/search affordances never appear — Anta owns that chrome.
   *  @defaultValue text */
  type?: 'text' | 'search' | 'email' | 'password' | 'tel' | 'url' | 'number'
  /** Native autocomplete token. Overrides the value derived from `type`
   *  (`email` / `tel` / `url`) — set it for the cases `type` can't express, e.g.
   *  `username`, `current-password`, `new-password`, `one-time-code`, or `off`. */
  autoComplete?:
    | 'off' | 'on' | 'name' | 'username' | 'email'
    | 'current-password' | 'new-password' | 'one-time-code'
    | 'tel' | 'url'
    | (string & {})
  /** Virtual-keyboard hint. Overrides the value derived from `type`. */
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
  /** Focus this field when its containing `Dialog` opens. */
  autoFocus?: boolean
  /** Form field name — submitted with the form via ElementInternals. */
  name?: string
  /** Placeholder shown when empty. */
  placeholder?: string
  /** Ellipsize an overflowing single-line value. Read-only inputs already do
   * this; pass `false` when an editable field should show the full value.
   * @defaultValue true */
  truncate?: boolean
  /** Disable the field. */
  disabled?: boolean
  /** Make the field read-only. */
  readOnly?: boolean
  /** Mark the field required (drives native validity). */
  required?: boolean
  /** Dim the `leading` / `trailing` adornments at rest; they brighten to full
   *  when the field is hovered or focused (a quiet-until-engaged affordance for
   *  trailing actions). */
  dimActions?: boolean
  /** Fully-round the field (`border-radius: 999px`). Pass a `number` (px) or a CSS
   *  length string for a custom radius. The `clearable` × button always rounds to
   *  a circle to match (it isn't sized by a custom field value). */
  round?: boolean | number | string
  /** Toggle native spell-checking. */
  spellCheck?: boolean
  /** Max input length. */
  maxLength?: number
  /** Min input length. */
  minLength?: number
  /** Validation pattern (single-line). */
  pattern?: string
  /** Min / max / step — for `type="number"`. */
  min?: number | string
  max?: number | string
  step?: number | string
  /** Fires on every keystroke. Read `e.target.value`. */
  onInput?: (e: any) => void
  /** Fires on **commit** (blur / Enter) — the platform `change` semantics, **not**
   *  React's per-keystroke `onChange`. This is a web component, so `onChange` keeps
   *  the native meaning; reach for `onInput` (every keystroke) or `onValueChange`
   *  (both) for live updates. Read `e.target.value`. */
  onChange?: (e: any) => void
  /** Unified value-change handler — the easy path for state. Fires on `input`
   *  *and* `change` (and on clear), with the native `event` plus a convenience
   *  `attrs` snapshot (`value`, `name`, `empty`, `valid`, `validationMessage`) so
   *  you can do `setForm(s => ({ ...s, [attrs.name]: attrs.value }))` without
   *  digging into the event. Use `event.type` to tell a live edit (`input`) from
   *  a commit (`change`); read `id` / `type` / `className` off `event.target`. */
  onValueChange?: (event: any, attrs: InputChangeAttrs) => void
  /** Fires when the built-in clear button (`clearable`) is clicked, *before*
   *  the field is cleared. Call `e.preventDefault()` to keep the current value
   *  — the clear is cancelled and `onClearInput` won't fire. Backed by the
   *  element's cancelable, bubbling `clearclick` event. */
  onClearClick?: (e: CustomEvent) => void
  /** Fires after the built-in clear button (`clearable`) has cleared the field
   *  — so `onInput` / `onChange` fire too — making this useful for reacting
   *  specifically to a clear. Doesn't fire if `onClearClick` cancelled the
   *  clear. Backed by the element's bubbling `clearinput` event. */
  onClearInput?: (e: CustomEvent) => void
  /** Fires when the field gains focus. */
  onFocus?: (e: any) => void
  /** Fires when the field loses focus. */
  onBlur?: (e: any) => void
  /** ARIA `role` for the field — e.g. `combobox` when the input drives a
   *  suggestion `listbox` (see `InputAutocomplete`). Left unset by default. */
  role?: string
  // Other standard DOM event handlers (onKeyDown, onPaste, onClick, …) come from
  // `DOMEventHandlers` and are forwarded to the field via `...rest`. Standard
  // events bubble/compose to the host (focus/blur reach it via delegatesFocus).
}

const presence = (on: boolean | undefined) => (on ? '' : undefined)
const isStringish = (n: React.ReactNode) => typeof n === 'string' || typeof n === 'number'

// Build the `onValueChange` attrs snapshot from the event target (the <a-input>
// host — the value retargets to it). Carries the value + derived results only;
// `name` is the lone caller-provided field, kept for keyed `[name]: value`
// updates. Read `id` / `type` / `className` off `event.target` if needed.
const attrsOf = (e: any): InputChangeAttrs => {
  const el = e?.target ?? {}
  const value = el.value ?? ''
  return {
    value,
    name: el.getAttribute?.('name') ?? undefined,
    empty: !value,
    valid: el.validity ? el.validity.valid : undefined,
    validationMessage: el.validationMessage ?? '',
  }
}

// Autocomplete default, derived from `type` (the `autoComplete` prop overrides
// it): the types that *are* valid autocomplete tokens map to themselves; the
// rest (text/password/number) have no standard token, so none is set — password
// managers still key off `type="password"`, the numeric keyboard off
// `type="number"`, etc. Pass `autoComplete` for the cases `type` can't express
// (`current-password`, `one-time-code`, …).
const AUTOCOMPLETE_BY_TYPE: Record<string, string> = { email: 'email', tel: 'tel', url: 'url' }
// Virtual-keyboard hint default, derived from `type` (the `inputMode` prop
// overrides it). `type` already drives the keyboard for these, so this is
// belt-and-suspenders; set `inputMode` to decouple keyboard from type (e.g. an OTP).
const INPUTMODE_BY_TYPE: Record<string, 'email' | 'tel' | 'url' | 'numeric' | 'search'> = {
  email: 'email', tel: 'tel', url: 'url', number: 'numeric', search: 'search',
}
// Default glyph per status, prefixed to the message. `neutral` has none (it's
// the no-status case). Overridable per instance via `statusIcon` (or
// `statusIcon={false}`).
const STATUS_ICON: Record<string, IconShape> = {
  critical: 'warning-diamond',
  warning: 'warning-triangle',
  success: 'circle-check',
  info: 'info',
  brand: 'circle-small-solid',
}

/**
 * `<Input>` — a text field. Renders an `<a-input>` web component whose real
 * `<input>` / `<textarea>` lives in shadow DOM, so it's self-contained: focus,
 * forms (via `ElementInternals`), IME, and autofill are all native, and the
 * control is reachable for styling through `::part(input)`.
 *
 * The wrapper is stateless — it maps props to attributes and slots. The clear
 * button is dropped into `slot="trailing"`; its click finds the host and calls
 * `clear()`, and its visibility is CSS off the element's `:state(filled)`.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only).
 *
 * @example
 * ```tsx
 * <Input label="Email" type="email" placeholder="you@example.com" clearable />
 * ```
 */
export const Input = ({
  label,
  hint,
  status,
  statusIcon,
  tone,
  size,
  round,
  value,
  defaultValue,
  multiline,
  rows,
  maxRows,
  clearable,
  leading,
  trailing,
  type,
  autoComplete,
  inputMode,
  autoFocus,
  name,
  placeholder,
  truncate = true,
  disabled,
  readOnly,
  required,
  dimActions,
  spellCheck,
  maxLength,
  minLength,
  pattern,
  min,
  max,
  step,
  onInput,
  onChange,
  onValueChange,
  onClearClick,
  onClearInput,
  children,
  className,
  style,
  ...rest
}: InputProps) => {
  // `hint` is the single message channel; `status` only recolors it + adds a
  // glyph. `statusIcon` overrides the per-status default; `false` drops it.
  const statusTone = status && status !== 'neutral' ? status : undefined
  const glyph = statusIcon === undefined ? (statusTone ? STATUS_ICON[statusTone] : undefined) : statusIcon

  // `type="search"` is a wrapper-only affordance: the `search` type never reaches
  // the DOM input (which would summon the browser's own clear/search UI). Instead
  // it defaults a leading search icon + a clear button — both overridable — while
  // the native input stays `text` (see the `type` prop doc).
  const isSearch = type === 'search'
  const nativeType = isSearch ? undefined : type
  const resolvedLeading = leading ?? (isSearch ? <Icon shape="search" /> : undefined)
  const resolvedClearable = isSearch ? clearable ?? true : clearable

  return (
    <a-input
      size={size && size !== 'medium' ? size : undefined}
      round={roundAttr(round)}
      value={value}
      // Pass `defaultvalue` even when controlled, so a <form> reset has a target
      // (the element resets to it and fires change → controlled state re-syncs).
      // `value` still wins for the live render — the element reads it first.
      defaultvalue={defaultValue}
      multiline={presence(multiline || rows != null)}
      rows={rows != null ? String(rows) : undefined}
      maxrows={maxRows != null ? String(maxRows) : undefined}
      status={statusTone}
      tone={tone || undefined}
      type={!multiline && rows == null ? nativeType : undefined}
      name={name}
      placeholder={placeholder}
      truncate={presence(truncate)}
      disabled={presence(disabled)}
      readonly={presence(readOnly)}
      required={presence(required)}
      dim-actions={presence(dimActions)}
      autocomplete={autoComplete ?? (!multiline && rows == null && type ? AUTOCOMPLETE_BY_TYPE[type] : undefined)}
      inputmode={inputMode ?? (!multiline && rows == null && type ? INPUTMODE_BY_TYPE[type] : undefined)}
      autofocus={autoFocus ? true : undefined}
      spellcheck={spellCheck != null ? (spellCheck ? 'true' : 'false') : undefined}
      maxlength={maxLength != null ? String(maxLength) : undefined}
      minlength={minLength != null ? String(minLength) : undefined}
      pattern={pattern}
      min={min}
      max={max}
      step={step}
      aria-invalid={status === 'critical' ? 'true' : undefined}
      oninput={onInput || onValueChange ? (e: any) => { onInput?.(e); onValueChange?.(e, attrsOf(e)) } : undefined}
      onchange={onChange || onValueChange ? (e: any) => { onChange?.(e); onValueChange?.(e, attrsOf(e)) } : undefined}
      onclearclick={onClearClick ? (e: any) => onClearClick(nativeStateChange(e).event) : undefined}
      onclearinput={onClearInput ? (e: any) => onClearInput(nativeStateChange(e).event) : undefined}
      class={className}
      style={roundStyle(round, '--input-round', toneStyle(tone, '--input-tone-source', style))}
      {...rest}
    >
      {label != null &&
        (isStringish(label) ? (
          <span slot="label">{label}</span>
        ) : (
          <span slot="label" style={{ display: 'contents' }}>
            {label}
          </span>
        ))}

      {resolvedLeading != null && (
        <span slot="leading" style={{ display: 'contents' }}>
          {resolvedLeading}
        </span>
      )}

      {resolvedClearable && (
        // A real <a-button> (light DOM → fully styled, keyboard-focusable) in
        // the element's `clear` slot — the element controls its visibility (shown
        // only when filled + editable). It fires the bubbling `clearrequest`
        // event via a-button's global listener, so clearing works even without
        // framework hydration; the element turns that into clearclick→clear().
        // CONTRACT: the `data-custom-event` value below MUST match `CLEAR_TRIGGER`
        // in the element (src/elements/a-input.ts). The string is duplicated, not
        // shared — importing the element module here would self-register it and
        // break the wrapper/element decoupling. Rename in both places.
        <span slot="clear" style={{ display: 'contents' }}>
          <Button
            priority="tertiary"
            size={size}
            round={!!round}
            icon="x"
            aria-label="Clear"
            data-custom-event="clearrequest"
          />
        </span>
      )}
      {trailing != null && (
        <span slot="trailing" style={{ display: 'contents' }}>
          {trailing}
        </span>
      )}

      {hint != null && (
        <span slot="hint" style={{ display: 'contents' }}>
          {glyph && (
            <Icon shape={glyph as IconShape} aria-hidden="true" />
          )}
          <span>{hint}</span>
        </span>
      )}

      {/* Unslotted extras → default slot, rendered under the field above the hint. */}
      {children}
    </a-input>
  )
}
