import type { BaseProps, DOMEventHandlers } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import { nativeStateChange, toneStyle } from '../anta_helpers'
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
   *  space and just anchors to the field — consistent with how tooltips attach
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
  /** Custom accent colour — any literal CSS colour tints the resting + hover
   *  border (focus ring stays the global `--focus-ring`). For consistency with the
   *  other controls' custom-tone knob; a `status` still overrides for validation. */
  tone?: string
  /** Size variant. small=24px, medium=28px, large=32px tall; the type scale and
   *  icon track the size (small 13/16 + 14px icon · medium 15/20 + 16px ·
   *  large 17/24 + 18px).
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
  /** Single-line input type. Ignored when `multiline`. (`search` is omitted
   *  deliberately — it triggers browser-injected clear/search affordances.)
   *  @defaultValue text */
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number'
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
  /** Form field name — submitted with the form via ElementInternals. */
  name?: string
  /** Placeholder shown when empty. */
  placeholder?: string
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
const INPUTMODE_BY_TYPE: Record<string, 'email' | 'tel' | 'url' | 'numeric'> = {
  email: 'email', tel: 'tel', url: 'url', number: 'numeric',
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
  name,
  placeholder,
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

  return (
    <a-input
      size={size && size !== 'medium' ? size : undefined}
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
      type={!multiline && rows == null ? type : undefined}
      name={name}
      placeholder={placeholder}
      disabled={presence(disabled)}
      readonly={presence(readOnly)}
      required={presence(required)}
      dim-actions={presence(dimActions)}
      autocomplete={autoComplete ?? (!multiline && rows == null && type ? AUTOCOMPLETE_BY_TYPE[type] : undefined)}
      inputmode={inputMode ?? (!multiline && rows == null && type ? INPUTMODE_BY_TYPE[type] : undefined)}
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
      style={toneStyle(tone, '--input-tone-source', style)}
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

      {leading != null && (
        <span slot="leading" style={{ display: 'contents' }}>
          {leading}
        </span>
      )}

      {clearable && (
        // A real <a-button> (light DOM → fully styled, keyboard-focusable) in
        // the element's `clear` slot — the element owns its visibility (shown
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
