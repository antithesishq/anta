import type { BaseProps, DOMEventHandlers } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import { nativeStateChange, toneStyle, roundStyle, roundAttr } from '../anta_helpers'
import { Button } from './Button'
import { Icon } from './Icon'

/** Convenience snapshot passed as the 2nd argument to `onValueChange`. */
export interface InputTimeChangeAttrs {
  /** Current value — 24-hour `"HH:mm"`, `''` when incomplete. */
  value: string
  /** The field's `name`, for keyed updates: `s => ({ ...s, [name]: value })`. */
  name?: string
  /** `true` when the value is empty / incomplete. */
  empty: boolean
  /** Whether the field currently passes validation. `undefined` where
   *  `ElementInternals` is unsupported. */
  valid?: boolean
  /** Current validation message (`''` when valid). */
  validationMessage: string
}

export interface InputTimeProps extends BaseProps, DOMEventHandlers {
  /** Extra content rendered under the field, above the hint (a no-box child like
   *  a `<Tooltip>` takes no space and just anchors to the field). */
  children?: React.ReactNode
  /** Field label, shown above the control and used as the segment group's
   *  accessible name. */
  label?: React.ReactNode
  /** Message below the field. `status` recolors it and prefixes a glyph. */
  hint?: React.ReactNode
  /** Validation / feedback tone. Only `critical` marks the field invalid; the
   *  others are advisory. Omit (or `neutral`) for a plain field. */
  status?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
  /** Glyph before the `hint` when `status` is set (per-status default; pass a
   *  shape to override, or `false` to drop it). */
  statusIcon?: IconShape | (string & {}) | false
  /** Custom accent colour — any literal CSS colour tints the resting + hover
   *  border (focus ring stays `--focus-ring`); `status` overrides for validation. */
  tone?: string
  /** Size variant. small=24px, medium=28px, large=32px tall.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Controlled value — 24-hour `"HH:mm"`. Pair with `onValueChange`. */
  value?: string
  /** Initial value for the uncontrolled case (24-hour `"HH:mm"`). */
  defaultValue?: string
  /** BCP-47 locale driving the clock (12h vs 24h), segment order, separator, and
   *  the AM/PM text.
   *  @defaultValue navigator.language */
  locale?: string
  /** Force the clock: `true` = 12-hour (AM/PM), `false` = 24-hour. Omit to follow
   *  the locale. */
  hour12?: boolean
  /** Earliest allowed time, 24-hour `"HH:mm"`. A complete value below it is
   *  clamped up (on step / blur) and flagged `rangeUnderflow` for form validity. */
  min?: string
  /** Latest allowed time, 24-hour `"HH:mm"`. A complete value above it is clamped
   *  down (on step / blur) and flagged `rangeOverflow`. */
  max?: string
  /** Form field name — the 24-hour value submits under this key. */
  name?: string
  /** Disable the field. */
  disabled?: boolean
  /** Mark the field required (drives native validity). */
  required?: boolean
  /** Leading icon at the start of the field — the clock affordance. Pass another
   *  shape to change it, or `false` to drop it.
   *  @defaultValue clock */
  icon?: IconShape | false
  /** Show a clear button once the field has a value. */
  clearable?: boolean
  /** Dim the trailing adornments at rest; they brighten on hover / focus. */
  dimActions?: boolean
  /** Content pinned to the end of the field (after the clear button). */
  trailing?: React.ReactNode
  /** Fully-round the field, or a custom radius (`number` px / CSS length). */
  round?: boolean | number | string
  /** Fires on every edit (`input`), with the native event + an `attrs` snapshot
   *  (`value`, `name`, `empty`, `valid`, `validationMessage`). Also fires on
   *  `change` (blur) and on clear. */
  onValueChange?: (event: any, attrs: InputTimeChangeAttrs) => void
  /** Fires after the built-in clear button has cleared the field. */
  onClearInput?: (e: CustomEvent) => void
  /** Fires when the field gains focus. */
  onFocus?: (e: any) => void
  /** Fires when the field loses focus. */
  onBlur?: (e: any) => void
}

const presence = (on: boolean | undefined) => (on ? '' : undefined)
const isStringish = (n: React.ReactNode) => typeof n === 'string' || typeof n === 'number'

const attrsOf = (e: any): InputTimeChangeAttrs => {
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

const STATUS_ICON: Record<string, IconShape> = {
  critical: 'warning-diamond',
  warning: 'warning-triangle',
  success: 'circle-check',
  info: 'info',
  brand: 'circle-small-solid',
}

/**
 * `<InputTime>` — a segmented wall-clock time field. One boxed input (matching
 * the other inputs) with separate hour / minute / (12-hour) AM-PM sections that
 * behave as one control: each is a native text input — ↑/↓ steps with wrap,
 * ←/→ crosses segments at caret boundaries, typing digits auto-advances, and
 * AM/PM accepts its locale text or `a`/`p`. Renders an `<a-input-time>` web
 * component that owns the segments, navigation, and form value (via
 * `ElementInternals`).
 *
 * The clock and layout follow the locale (`en-US` → 12-hour, most others 24),
 * overridable with `hour12`. The value is a 24-hour `"HH:mm"` string; controlled
 * (`value` + `onValueChange`) or uncontrolled (`defaultValue`), submitting under
 * `name`.
 *
 * Requires `@antadesign/anta/elements` (client-side only). Reads
 * `navigator.language` at render, so render client-side (not SSR-safe).
 *
 * @example
 * ```tsx
 * <InputTime label="Start" defaultValue="09:30" onValueChange={(_, { value }) => save(value)} />
 * ```
 */
export const InputTime = ({
  label,
  hint,
  status,
  statusIcon,
  tone,
  size,
  round,
  value,
  defaultValue,
  locale,
  hour12,
  min,
  max,
  name,
  disabled,
  required,
  icon,
  clearable,
  dimActions,
  trailing,
  onValueChange,
  onClearInput,
  children,
  className,
  style,
  ...rest
}: InputTimeProps) => {
  const statusTone = status && status !== 'neutral' ? status : undefined
  const glyph = statusIcon === undefined ? (statusTone ? STATUS_ICON[statusTone] : undefined) : statusIcon

  return (
    <a-input-time
      size={size && size !== 'medium' ? size : undefined}
      round={roundAttr(round)}
      value={value}
      defaultvalue={defaultValue}
      locale={locale}
      hour12={hour12 === undefined ? undefined : hour12 ? 'true' : 'false'}
      min={min}
      max={max}
      status={statusTone}
      tone={tone || undefined}
      name={name}
      disabled={presence(disabled)}
      required={presence(required)}
      dim-actions={presence(dimActions)}
      aria-invalid={status === 'critical' ? 'true' : undefined}
      oninput={onValueChange ? (e: any) => onValueChange(e, attrsOf(e)) : undefined}
      onchange={onValueChange ? (e: any) => onValueChange(e, attrsOf(e)) : undefined}
      onclearinput={onClearInput ? (e: any) => onClearInput(nativeStateChange(e).event) : undefined}
      class={className}
      style={roundStyle(round, '--input-time-round', toneStyle(tone, '--input-time-tone-source', style))}
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

      {icon !== false && (
        <span slot="leading" style={{ display: 'contents' }}>
          <Icon shape={icon ?? 'clock'} />
        </span>
      )}

      {clearable && (
        // Real <a-button> in the element's `clear` slot; the element owns its
        // visibility (shown only when filled). It fires `clearrequest`, which the
        // element turns into clear(). CONTRACT: `data-custom-event` MUST match
        // CLEAR_TRIGGER in src/elements/a-input-time.ts (string duplicated, not
        // shared, to keep the wrapper/element decoupled).
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
          {glyph && <Icon shape={glyph as IconShape} aria-hidden="true" />}
          <span>{hint}</span>
        </span>
      )}

      {children}
    </a-input-time>
  )
}
