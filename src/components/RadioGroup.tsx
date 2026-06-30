// Hooks come from the jsx-runtime indirection (configurable via `configure()`),
// not a hard `react` import — so a custom runtime resolves them, not whatever
// `react` maps to. See CLAUDE.md (stateless-wrapper exception for RadioGroup).
import { useId, useState } from "../jsx-runtime"
import { nativeStateChange, toneStyle } from "../anta_helpers"
import type { BaseProps } from "../general_types"

/** The element's `statechange` payload. `next`/`prev` are values (`null` = nothing
 *  selected); `reason` distinguishes a user pick from a form reset / bfcache restore. */
type StateReason = "user" | "reset" | "restore"
type StateDetail = { next: string | null; prev: string | null; reason: StateReason }
type StateChangeEvent = CustomEvent<StateDetail>

/** Snapshot passed as the 2nd argument to `onValueChange` — the new value plus the
 *  field name, so you don't poke at `event.target`. Mirrors `Input`/`Checkbox`. */
export interface RadioChangeAttrs {
  value: string | null
  name?: string
}

const radioAttrsOf = (el: any): RadioChangeAttrs => ({
  value: el?.value ?? null,
  name: el?.getAttribute?.("name") ?? undefined,
})

/** One option in a `<RadioGroup>`. The wrapper renders an `<a-radio>` per entry. */
export interface RadioOption {
  /** This option's identity and the value submitted when it's selected.
   *  Must be unique within the group (a dev-only warning fires on duplicates). */
  value: string
  /** The visible label. */
  label?: React.ReactNode
  /** Secondary text under the label — explanatory copy, like `Input`'s hint. */
  hint?: React.ReactNode
  /** Disable just this option (skipped by keyboard, dropped from the tab order). */
  disabled?: boolean
  /** Override this one option's tone (defaults to the group's `tone`). */
  tone?: "brand" | "neutral" | "info" | "success" | "warning" | "critical" | (string & {})
  /** Override this one option's size (defaults to the group's `size`). */
  size?: "small" | "medium" | "large"
  /** Override this one option's priority (defaults to the group's `priority`). */
  priority?: "primary" | "secondary"
}

/** Public props for `<RadioGroup>` — the single-select container. */
export interface RadioGroupProps extends Omit<BaseProps, "children" | "onChange"> {
  /** The options. The wrapper renders one `<a-radio>` per entry and computes its
   *  `selected` / roving `tabindex` / `role` declaratively. */
  options: RadioOption[]
  /** Controlled selected value. When provided, the consumer owns selection: the
   *  group follows this prop and a pick only *requests* a change via
   *  `onStateChange` (reject by not updating). Leave undefined for uncontrolled. */
  value?: string
  /** Initial selected value for the uncontrolled case (the wrapper then owns the
   *  selection in local state). */
  defaultValue?: string
  /** Fired whenever selection changes — event-first. `detail` is
   *  `{ next, prev, reason }`: `next`/`prev` are values (`null` = nothing selected);
   *  `reason` is `'user'` | `'reset'` | `'restore'`. A `'user'` pick fires *before*
   *  applying and is **cancelable** — `event.preventDefault()` vetoes it
   *  (uncontrolled), or in controlled mode answer by updating `value` (reject by
   *  doing nothing). `'reset'` (form reset) and `'restore'` (bfcache / autofill) are
   *  not cancelable — filter on `reason` if you only track user picks. */
  onStateChange?: (event: StateChangeEvent, detail: StateDetail) => void
  /** Fired *after* the selection changes — a native `change` event (the post-apply
   *  counterpart to `onStateChange`). Not cancelable; for a controlled group it
   *  fires once you've updated `value`. */
  onChange?: (event: Event) => void
  /** Like `onChange`, but with a `{ value, name }` snapshot as the 2nd argument —
   *  the ergonomic "just give me the new value" callback (mirrors `Input`). */
  onValueChange?: (event: Event, attrs: RadioChangeAttrs) => void
  /** Fired when focus enters the group (any option) — wired to `focusin`, since
   *  focus lands on an individual option, not the group element itself. */
  onFocus?: (event: FocusEvent) => void
  /** Fired when focus leaves the group entirely — wired to `focusout`. */
  onBlur?: (event: FocusEvent) => void
  /** Form field name — the group submits one `name=value` (it's the
   *  form-associated element). */
  name?: string
  /** Plain-text label for the whole group, rendered above the options. */
  label?: string
  /** Plain-text description for the group, rendered directly under `label` (above
   *  the options) — typically instructional copy. Per-option helper text goes on
   *  the option's own `hint` instead. */
  hint?: string
  /** Validation/feedback tone for the group `hint` — recolours it (same tone set
   *  as `Input`'s `status`). Use `critical` for an error message, etc.; omit for
   *  the neutral default.
   *  @defaultValue 'neutral' */
  status?: "neutral" | "brand" | "info" | "success" | "warning" | "critical"
  /** Tone applied to every option (an option's own `tone` wins), or any literal
   *  CSS color for a one-off custom tone. Tints fill, label, hint, and the
   *  unselected ring border. Named tones track light/dark mode.
   *  @defaultValue 'neutral' */
  tone?: "brand" | "neutral" | "info" | "success" | "warning" | "critical" | (string & {})
  /** Size applied to every option (an option's own `size` wins).
   *  @defaultValue 'medium' */
  size?: "small" | "medium" | "large"
  /** Visual priority applied to every option (an option's own `priority` wins).
   *  `primary` fills the selected ring with the tone colour and draws a white dot;
   *  `secondary` keeps the ring unfilled and draws the border + dot in the tone
   *  colour (an outlined look).
   *  @defaultValue 'primary' */
  priority?: "primary" | "secondary"
  /** Disable the whole group. */
  disabled?: boolean
  /** Layout + arrow-key axis.
   *  @defaultValue 'vertical' */
  orientation?: "vertical" | "horizontal"
}

/**
 * `<RadioGroup>` — a single-select radio control, rendered from `options`.
 *
 * This wrapper is convenience over the web components: it renders an `<a-radio>`
 * per option and, crucially, owns the two **declarative** DOM concerns the
 * elements deliberately don't touch — the roving **`tabindex`** (so keyboard Tab
 * lands on the right option) and each radio's **`role`**. Selection itself lives
 * in `<a-radio-group>` off-DOM (it sets each radio's `selected` property), so the
 * elements never mutate the DOM; this wrapper just reflects the current value into
 * `tabindex` on re-render. (Hand-assembling raw `<a-radio-group>` / `<a-radio>`
 * also works — see the element docs — this wrapper is the ergonomic path.)
 *
 * Controlled (`value` + `onStateChange`) or uncontrolled (`defaultValue`); either
 * way the wrapper holds the value so it can compute the roving `tabindex`.
 *
 * Requires `@antadesign/anta/elements` (client-side only).
 */
export const RadioGroup = ({
  options,
  value,
  defaultValue,
  onStateChange,
  onChange,
  onValueChange,
  onFocus,
  onBlur,
  name,
  label,
  hint,
  status,
  tone,
  size,
  priority,
  disabled,
  orientation,
  className,
  style,
  ...rest
}: RadioGroupProps) => {
  const controlled = value !== undefined
  // Uncontrolled selection lives here (re-renders declaratively) rather than in
  // the element — the wrapper needs the value to compute the roving tabindex, and
  // component state re-rendering is allowed where element DOM mutation isn't.
  const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue)
  const currentValue = controlled ? value : internalValue

  // Values are an option's identity — duplicates make selection ambiguous. Warn
  // (only ever fires on the bug itself), matching a-input's bare console.warn.
  const seen = new Set<string>()
  for (const o of options) {
    if (seen.has(o.value))
      console.warn(`[anta] <RadioGroup> duplicate option value ${JSON.stringify(o.value)} — values must be unique.`)
    seen.add(o.value)
  }

  // aria-labelledby points the radiogroup's accessible name at the visible label;
  // aria-describedby points its description at the group hint.
  const labelId = useId()
  const hintId = useId()

  // The single roving tab stop. Prefer the *selected* option — even when it's
  // disabled (focusable-disabled is ARIA-allowed), so Tab always reaches the visible
  // selection — else the first enabled option. None when the whole group is disabled.
  const tabStopValue = disabled
    ? undefined
    : (options.find((o) => o.value === currentValue)?.value ??
       options.find((o) => !o.disabled)?.value)

  const onstatechange = (e: StateChangeEvent) => {
    const { event, detail } = nativeStateChange<StateDetail>(e)
    if (!detail) return
    onStateChange?.(event, detail)
    if (controlled) return
    // Mirror every change (pick / reset / restore) so the roving tabindex follows
    // the element's selection. The only case we skip is a *vetoed* user pick;
    // reset/restore are never cancelable. (B2: in controlled mode a rejected pick
    // leaves the tab stop on the still-selected option — accepted, APG-correct.)
    if (detail.reason === "user" && event.defaultPrevented) return
    setInternalValue(detail.next ?? undefined)
  }

  // Native `change` (post-apply). `onValueChange` adds the value snapshot.
  const onchange =
    onChange || onValueChange
      ? (e: Event) => {
          onChange?.(e)
          onValueChange?.(e, radioAttrsOf(e.currentTarget))
        }
      : undefined

  return (
    <a-radio-group
      role="radiogroup"
      aria-disabled={disabled ? "true" : undefined}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={hint ? hintId : undefined}
      {...rest}
      // Controlled → drive the element's `state`. Uncontrolled → seed `default-state`
      // and let the ELEMENT own selection (it self-applies on pick, off-DOM via each
      // radio's `selected` property) — so a radio works even unhydrated (static docs
      // preview) or hand-assembled. Either way the wrapper's `useState` mirror (kept
      // current via `onstatechange`) is what feeds the roving `tabindex` below.
      state={controlled ? value : undefined}
      default-state={!controlled ? defaultValue : undefined}
      name={name}
      status={status && status !== "neutral" ? status : undefined}
      tone={tone && tone !== "neutral" ? tone : undefined}
      size={size && size !== "medium" ? size : undefined}
      priority={priority && priority !== "primary" ? priority : undefined}
      disabled={disabled ? "" : undefined}
      orientation={orientation && orientation !== "vertical" ? orientation : undefined}
      onstatechange={onstatechange}
      // Native `change` (post-apply), same lowercase spelling as `<a-input>`.
      onchange={onchange}
      // Focus lands on an individual option, not the group — so report group focus
      // via the bubbling `focusin` / `focusout` (not `focus` / `blur`, which don't
      // bubble and would never fire for child focus).
      onfocusin={onFocus}
      onfocusout={onBlur}
      class={className}
      style={toneStyle(tone, "--radio-tone-source", style)}
    >
      {label && <a-radio-group-label id={labelId}>{label}</a-radio-group-label>}
      {hint && <a-radio-group-hint id={hintId}>{hint}</a-radio-group-hint>}
      <a-radio-list>
        {options.map((o) => {
          const optDisabled = disabled || o.disabled
          return (
            <a-radio
              key={o.value}
              role="radio"
              value={o.value}
              aria-disabled={optDisabled ? "true" : undefined}
              // Roving tabindex — the wrapper's job (declarative DOM). Exactly one
              // radio (the tab stop) is 0, the rest are -1; the tab stop may be a
              // disabled-but-selected option (focusable-disabled). `aria-checked` is
              // NOT set here — the element publishes it off-DOM via internals.
              tabIndex={o.value === tabStopValue ? 0 : -1}
              tone={o.tone && o.tone !== "neutral" ? o.tone : undefined}
              size={o.size && o.size !== "medium" ? o.size : undefined}
              priority={o.priority && o.priority !== "primary" ? o.priority : undefined}
              disabled={o.disabled ? "" : undefined}
              style={toneStyle(o.tone, "--radio-tone-source")}
            >
              <a-radio-label>{o.label}</a-radio-label>
              {o.hint != null && <a-radio-hint>{o.hint}</a-radio-hint>}
            </a-radio>
          )
        })}
      </a-radio-list>
    </a-radio-group>
  )
}
