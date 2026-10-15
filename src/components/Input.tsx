import type { AInputAttributes, BaseProps, DOMEventHandlers } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import { nativeStateChange, neutralToneAttr, toneStyle, roundStyle, roundAttr } from '../anta_helpers'
import { Button } from './Button'
import { Icon } from './Icon'
import { useLayoutEffect, useState } from '../jsx-runtime'

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
  /** Whether the field currently passes validation (native constraints and `status`). `undefined`
   *  where `ElementInternals` is unsupported. */
  valid?: boolean
  /** Current validation message (`''` when valid). */
  validationMessage: string
}

export interface InputProps extends BaseProps, DOMEventHandlers {
  /** Extra content between the field and hint. A `Tooltip` child anchors to the
   * field. Use `leading` and `trailing` for content inside the field. */
  children?: React.ReactNode
  /** Visible field label and accessible name for the native control. Accepts text
   * or JSX. Accessible naming follows the current label content. */
  label?: React.ReactNode
  /** Persistent help or feedback below the field. `status` colors the message and
   * adds a status icon. */
  hint?: React.ReactNode
  /** Feedback color for the field and hint. `critical` marks the field invalid,
   * sets `aria-invalid` and `:state(invalid)`, and blocks normal form submission.
   * Other statuses add no validation error; native constraints still apply. Omit
   * or use `neutral` for a plain field. */
  status?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
  /** Icon before the hint. The defaults are `warning-diamond` for critical,
   * `warning-triangle` for warning, `circle-check` for success, `info` for info,
   * and `circle-small-solid` for brand. Pass a shape to replace it or `false` to
   * hide it. Neutral has no default icon. */
  statusIcon?: IconShape | (string & {}) | false
  /** Custom CSS border color. A non-neutral `status` takes precedence. The focus
   * ring uses the global `--focus-ring`. */
  tone?: string
  /** Field emphasis. `primary` has a fill and border, `secondary` keeps the
   *  border without a fill, and `tertiary` makes the border transparent until
   *  hover or focus.
   *  Status borders remain visible at rest.
   *  @defaultValue primary */
  priority?: 'primary' | 'secondary' | 'tertiary'
  /** Field height, text size, and icon size. Field heights are 24px for small, 28px
   * for medium, and 32px for large.
   * @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Controlled value. Update it with `onInput` or `onValueChange` for live
   * editing. */
  value?: string
  /** Initial value for an uncontrolled field, restored on form reset. */
  defaultValue?: string
  /** Render a textarea. Without `rows`, it grows with content up to `maxRows` when
   * set. Autogrow uses native field sizing where supported, with a JavaScript
   * fallback in WebKit and browsers without support. */
  multiline?: boolean
  /** Fixed visible row count. Also enables `multiline`. */
  rows?: number
  /** Maximum row count for autogrow when `rows` is unset. Omit for unlimited
   * growth. */
  maxRows?: number
  /** Show a clear button before trailing content when an editable field has a
   * value. */
  clearable?: boolean
  /** Content at the start of the field, such as an icon or text. */
  leading?: React.ReactNode
  /** Content at the end of the field, after the clear button. Icon-only buttons
   * automatically fit the Input size. */
  trailing?: React.ReactNode
  /** Native single-line input type. Ignored for multiline fields. `search` uses a
   * native text input with a leading search icon, a clear button, and
   * `inputmode="search"`. Override `leading` or set `clearable={false}` to
   * customize it.
   * @defaultValue text */
  type?: 'text' | 'search' | 'email' | 'password' | 'tel' | 'url' | 'number'
  /** Native autocomplete token describing the field purpose. Overrides the token
   * derived from the email, tel, or url type. Set an explicit token for other
   * purposes, such as `username`, `current-password`, or `one-time-code`. */
  autoComplete?:
    | 'off' | 'on' | 'name' | 'username' | 'email'
    | 'current-password' | 'new-password' | 'one-time-code'
    | 'tel' | 'url'
    | (string & {})
  /** Virtual keyboard hint. Overrides the value derived from `type` without
   * changing validation. */
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
  /** Focus this field when its containing `Dialog` opens. */
  autoFocus?: boolean
  /** Form field name, submitted through ElementInternals. Property updates
   *  stay internal; they do not reflect into the host's `name` attribute. */
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
  /** Render the field surface with a native button as its focus target. This is
   *  available for Input-styled popup triggers; the value becomes
   *  the button text and the placeholder is shown while it is empty. */
  button?: boolean
  /** Mark the field required (drives native validity). */
  required?: boolean
  /** Display leading, trailing, and clear content at 60% opacity, returning to full
   * opacity when the field is hovered or focused. */
  dimActions?: boolean
  /** Use a 999px border radius. Pass a number in pixels or a CSS length for a
   * custom radius. The clear button stays circular. */
  round?: boolean | number | string
  /** Toggle native spell-checking. */
  spellCheck?: boolean
  /** Maximum text length for native types that support it. */
  maxLength?: number
  /** Minimum text length for native types that support it. */
  minLength?: number
  /** Validation pattern for supported single-line types. Checks validity without
   * preventing typing. */
  pattern?: string
  /** Minimum value for `type="number"`. */
  min?: number | string
  /** Maximum value for `type="number"`. */
  max?: number | string
  /** Allowed increment for `type="number"`. */
  step?: number | string
  /** Fires when editing changes the value or the field is cleared. Read
   * `e.target.value`. */
  onInput?: (e: any) => void
  /** Fires on native commit, such as blur or Enter, and on clear. Use `onInput` or
   * `onValueChange` for live edits. Read `e.target.value`. */
  onChange?: (e: any) => void
  /** Fires on both `input` and `change`, including clear, with a serializable
   * snapshot of `value`, `name`, `empty`, `valid`, and `validationMessage`. Can
   * run more than once per edit. Use `event.type` to distinguish the events. */
  onValueChange?: (event: any, attrs: InputChangeAttrs) => void
  /** Fires before the built-in clear action. Call `e.preventDefault()`
   * synchronously to keep the value and cancel `onClearInput`. Corresponds to the
   * cancelable, bubbling `clearclick` event. */
  onClearClick?: (e: CustomEvent) => void
  /** Fires after clearing, following `onInput` and `onChange`. Does not fire when
   * clearing is canceled. Corresponds to the bubbling `clearinput` event. */
  onClearInput?: (e: CustomEvent) => void
  /** Fires when the field gains focus. */
  onFocus?: (e: any) => void
  /** Fires when the field loses focus. */
  onBlur?: (e: any) => void
  /** ARIA role for the native control, such as `combobox` for an InputAutocomplete
   * trigger. The element delegates this and standard `aria-*` props to its native
   * shadow control. */
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
    name: el.name || undefined,
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

type InputElementProps = AInputAttributes & { children?: React.ReactNode }

function HydratedInput({ children, oninput, onchange, onclearclick, onclearinput, ...attributes }: InputElementProps) {
  const [listening, setListening] = useState(false)
  // React hydration attaches native custom-element event props after a commit.
  useLayoutEffect(() => setListening(true), [])
  return (
    <a-input {...attributes}
      oninput={listening ? oninput : undefined}
      onchange={listening ? onchange : undefined}
      onclearclick={listening ? onclearclick : undefined}
      onclearinput={listening ? onclearinput : undefined}
    >
      {children}
    </a-input>
  )
}

/**
 * `<Input>` — a text field. Renders an `<a-input>` web component whose real
 * `<input>` / `<textarea>` lives in shadow DOM, so it's self-contained: focus,
 * forms (via `ElementInternals`), IME, and autofill are all native, and the
 * control is reachable for styling through `::part(input)`.
 *
 * The wrapper maps props to attributes and slots. In the browser, a state-only
 * mount commit installs event handlers after hydration without DOM access. The clear
 * button uses the `clear` slot and requests clearing through a native event.
 * Its visibility follows the element's `:state(filled)`.
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
  priority,
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
  button,
  required,
  dimActions,
  spellCheck,
  maxLength,
  minLength,
  pattern,
  min,
  max,
  step,
  role,
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
  // Server and worker projections stay pure. The browser helper stays mounted
  // when callbacks change, preserving the native control and uncontrolled value.
  const InputTag = typeof window === 'undefined' ? 'a-input' : HydratedInput

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
    <InputTag
      priority={priority && priority !== 'primary' ? priority : undefined}
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
      tone={neutralToneAttr(tone)}
      type={!multiline && rows == null ? nativeType : undefined}
      name={name}
      placeholder={placeholder}
      truncate={presence(truncate)}
      disabled={presence(disabled)}
      readonly={presence(readOnly)}
      button={presence(button)}
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
      role={role ?? (isSearch ? 'searchbox' : undefined)}
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
          <span slot="label" data-input-contents="">
            {label}
          </span>
        ))}

      {resolvedLeading != null && (
        <span slot="leading" data-input-contents="">
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
        <span slot="clear" data-input-contents="">
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
        <span slot="trailing" data-input-contents="">
          {trailing}
        </span>
      )}

      {hint != null && (
        <span slot="hint" data-input-contents="">
          {glyph && (
            <Icon shape={glyph as IconShape} aria-hidden="true" />
          )}
          <span>{hint}</span>
        </span>
      )}

      {/* Unslotted extras → default slot, rendered under the field above the hint. */}
      {children}
    </InputTag>
  )
}
