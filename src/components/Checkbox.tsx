import { nativeStateChange, toneStyle, roundStyle } from "../anta_helpers"
import type { BaseProps } from "../general_types"

/** The wrapper-level checked value: a boolean for the binary axis, the string
 *  `'indeterminate'` for the third state. Mirrors Radix's `Checkbox.Root`. */
export type CheckboxValue = boolean | 'indeterminate'

/** The element-level state enum (the string vocabulary on `<a-checkbox>`'s
 *  `state` / `default-state` attributes and its `statechange` event detail). */
type CheckboxState = 'checked' | 'unchecked' | 'indeterminate'

const valueToState = (v: CheckboxValue): CheckboxState =>
  v === 'indeterminate' ? 'indeterminate' : v ? 'checked' : 'unchecked'

const stateToValue = (s: CheckboxState): CheckboxValue =>
  s === 'indeterminate' ? 'indeterminate' : s === 'checked'

/** The element's `statechange` event payload. */
type StateDetail = { next: CheckboxState; prev: CheckboxState }
type StateChangeEvent = CustomEvent<StateDetail>

/** Snapshot passed as the 2nd argument to `onValueChange` — the new value plus
 *  form-relevant fields, so you don't poke at `event.target`. Mirrors `Input`'s
 *  `onValueChange` convention. */
export interface CheckboxChangeAttrs {
  checked: boolean
  indeterminate: boolean
  name?: string
  value: string
}

const checkboxAttrsOf = (el: any): CheckboxChangeAttrs => ({
  checked: !!el?.checked,
  indeterminate: !!el?.indeterminate,
  name: el?.getAttribute?.('name') ?? undefined,
  value: el?.getAttribute?.('value') ?? 'on',
})

export interface CheckboxProps extends BaseProps {
  /** Visible label — the *value* of the checkbox (clicked along with the box).
   *  Convenience for the common single-string case; for richer content (markup,
   *  a link, an info icon) use `children`. When both are supplied, `label`
   *  renders first. Required unless `children` or `aria-label` is provided
   *  (a `role="checkbox"` takes its name from the author, not the markup). */
  label?: string
  /** Secondary text rendered under the label — explanatory copy, like
   *  Input's hint. Not part of the accessible name. */
  hint?: React.ReactNode
  /** Controlled checked state. When provided the checkbox is controlled — it
   *  renders exactly this and never self-applies; `onStateChange` is a *request*
   *  the consumer accepts by updating this prop. Use `defaultChecked` for an
   *  uncontrolled checkbox. `'indeterminate'` shows the minus glyph and takes
   *  visual precedence; clicking it requests `true`. */
  checked?: CheckboxValue
  /** Initial checked state for an uncontrolled checkbox. Read once; later
   *  changes ignored (the element then owns the state).
   *  @defaultValue false */
  defaultChecked?: CheckboxValue
  /** Disable the checkbox (no interaction, dropped from the tab order). */
  disabled?: boolean
  /** Round the checkbox mark to a circle (`border-radius: 999px` on the box). Pass
   *  a `number` (px) or a CSS length string for a rounded-square mark instead. */
  round?: boolean | number | string
  /** Form field name. Inside a `<form>` the checkbox submits under this name,
   *  contributing `value` when checked — like a native checkbox. */
  name?: string
  /** Value submitted with the form when checked — like a native checkbox.
   *  @defaultValue "on" */
  value?: string
  /** Colour of the **mark** — the checked-box fill and the unselected box border.
   *  A named tone or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) for a
   *  one-off custom tone. Named tones track light/dark mode automatically via the
   *  theme-aware role tokens; a custom colour keeps its hue + chroma and pins
   *  lightness to the fill curve. The label + hint stay neutral — use `toneText`
   *  to recolour those.
   *  @defaultValue 'neutral' */
  tone?: 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Colour of the **text** — the label and hint — independent of `tone`. A named
   *  tone or any literal CSS color. Named tones track light/dark via the theme-aware
   *  `--text-*` role tokens. Omit to leave the text neutral.
   *  @defaultValue 'neutral' */
  toneText?: 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size variant. small=14px, medium=16px, large=18px box.
   *  @defaultValue 'medium' */
  size?: 'small' | 'medium' | 'large'
  /** Fired on click / Space *before* the element applies any change. Event-first
   *  so `event.preventDefault()` is the synchronous veto (uncontrolled mode);
   *  `detail` carries `{ next, prev }`. In controlled mode the element never
   *  self-applies — answer by updating `checked`, reject by doing nothing. */
  onStateChange?: (
    event: StateChangeEvent,
    detail: { next: CheckboxValue; prev: CheckboxValue },
  ) => void
  /** Fired *after* the checked state changes — a native `change` event (the
   *  post-apply counterpart to `onStateChange`). Not cancelable. For a controlled
   *  checkbox this fires once you've updated `checked`. */
  onChange?: (event: Event) => void
  /** Like `onChange`, but with a `{ checked, indeterminate, name, value }` snapshot
   *  as the 2nd argument — the ergonomic "just give me the new value" callback
   *  (mirrors `Input`'s `onValueChange`). */
  onValueChange?: (event: Event, attrs: CheckboxChangeAttrs) => void
}

/**
 * Checkbox. Renders an `<a-checkbox>` web component that owns the visual
 * state; controlled via `checked` + `onStateChange`, or uncontrolled via
 * `defaultChecked`. Label is `label` (or `children`); `hint` adds secondary
 * text under the label. Requires `@antadesign/anta/elements`.
 *
 * ```tsx
 * <Checkbox checked={agreed} onStateChange={(e, { next }) => setAgreed(next)}>
 *   I agree
 * </Checkbox>
 * <Checkbox defaultChecked label="Remember me" hint="On this device" />
 * ```
 */
export const Checkbox = ({
  checked,
  defaultChecked,
  disabled,
  tone,
  toneText,
  size,
  round,
  onStateChange,
  onChange,
  onValueChange,
  label,
  hint,
  className,
  style,
  children,
  tabIndex,
  ...rest
}: CheckboxProps) => {
  // The wrapper is stateless on purpose (matches every other Anta wrapper; keeps
  // `configure()` portability). `aria-checked` is NOT set here — `<a-checkbox>`
  // publishes it off-DOM via `ElementInternals`, so it stays live through
  // uncontrolled self-toggles (a wrapper-set value would go stale there).

  // A non-named tone/toneText is a custom CSS color — `toneStyle` hands each to the
  // element via its `--checkbox-tone-source` / `--checkbox-tone-text-source` var; the
  // element's CSS derives the fill / text curve. Chained so both can be custom.
  const computedStyle = roundStyle(
    round,
    '--checkbox-round',
    toneStyle(
      toneText,
      '--checkbox-tone-text-source',
      toneStyle(tone, '--checkbox-tone-source', style),
    ),
  )

  // The accessible name is wrapper-derived (matches `Input` and the "ARIA lives
  // in the wrapper" rule): a string label / children becomes the box's
  // `aria-label` automatically, so consumers don't hand-write it. An explicit
  // `aria-label` in `...rest` still wins.
  const explicitAriaLabel = rest['aria-label']
  const ariaLabel =
    (typeof explicitAriaLabel === 'string' ? explicitAriaLabel : undefined) ??
    label ??
    (typeof children === 'string' ? children : undefined)

  const onstatechange = onStateChange
    ? (e: StateChangeEvent) => {
        const { event, detail } = nativeStateChange<StateDetail>(e)
        if (!detail) return
        onStateChange(event, {
          next: stateToValue(detail.next),
          prev: stateToValue(detail.prev),
        })
      }
    : undefined

  // Native `change` (post-apply). `onValueChange` adds the value snapshot; both read
  // the new value off the element (`event.currentTarget`).
  const onchange =
    onChange || onValueChange
      ? (e: Event) => {
          onChange?.(e)
          onValueChange?.(e, checkboxAttrsOf(e.currentTarget))
        }
      : undefined

  // Emit `state` or `default-state`, never both — the DOM never carries a
  // stale state attribute, and TS narrows `checked` / `defaultChecked` to
  // non-undefined inside each branch (no casts needed).
  const stateAttr = checked !== undefined ? valueToState(checked) : undefined
  const defaultStateAttr =
    checked === undefined && defaultChecked !== undefined
      ? valueToState(defaultChecked)
      : undefined

  const hasLabel = label != null || children != null

  return (
    <a-checkbox
      role="checkbox"
      aria-disabled={disabled ? 'true' : undefined}
      aria-label={ariaLabel}
      {...rest}
      state={stateAttr}
      default-state={defaultStateAttr}
      disabled={disabled ? '' : undefined}
      tone={tone && tone !== 'neutral' ? tone : undefined}
      tone-text={toneText && toneText !== 'neutral' ? toneText : undefined}
      size={size && size !== 'medium' ? size : undefined}
      round={round ? '' : undefined}
      tabIndex={disabled ? -1 : (tabIndex ?? 0)}
      // All-lowercase `onstatechange` is the one event-prop spelling both
      // renderers bind to our custom `statechange` event: React 19 keeps the
      // case of whatever follows `on`, Preact lowercases. The native-listener
      // path is what lets `event.preventDefault()` reach the element's
      // `dispatchEvent()` return.
      onstatechange={onstatechange}
      // Lowercase `onchange` binds the element's native `change` (post-apply) in
      // both React 19 and Preact, same as `<a-input>`. `onFocus` / `onBlur` flow
      // through `...rest` — the host is the focusable element, so they fire natively.
      onchange={onchange}
      class={className}
      style={computedStyle}
    >
      {hasLabel && (
        <a-checkbox-label>
          {label}
          {children}
        </a-checkbox-label>
      )}
      {hint != null && <a-checkbox-hint>{hint}</a-checkbox-hint>}
    </a-checkbox>
  )
}
