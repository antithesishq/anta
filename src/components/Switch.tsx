import { nativeStateChange, toneStyle } from "../anta_helpers"
import type { BaseProps } from "../general_types"

type SwitchState = 'checked' | 'unchecked'
type StateDetail = { next: SwitchState; prev: SwitchState }
type StateChangeEvent = CustomEvent<StateDetail>

/** Snapshot passed to `onValueChange` after the switch's value changes. */
export interface SwitchChangeAttrs {
  checked: boolean
  name?: string
  value: string
}

const switchAttrsOf = (element: any): SwitchChangeAttrs => ({
  checked: !!element?.checked,
  name: element?.getAttribute?.('name') ?? undefined,
  value: element?.getAttribute?.('value') ?? 'on',
})

export interface SwitchProps extends BaseProps {
  /** Visible, stable label for the setting. Use `children` for richer label content. */
  label?: string
  /** Controlled checked value. In controlled mode, update this in `onStateChange`. */
  checked?: boolean
  /** Initial checked value for an uncontrolled switch.
   * @defaultValue false */
  defaultChecked?: boolean
  /** Disables interaction and removes the switch from the tab order. */
  disabled?: boolean
  /** Form field name. A checked switch submits `value` under this name. */
  name?: string
  /** Value submitted while checked.
   * @defaultValue "on" */
  value?: string
  /** Colour of the checked track. The off track remains neutral.
   * @defaultValue 'brand' */
  tone?: 'brand' | 'neutral' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Size variant. small=30×14px, medium=30×18px, large=42×22px.
   * @defaultValue 'medium' */
  size?: 'small' | 'medium' | 'large'
  /** Put the visible label before or after the control. Grid layout changes only
   * the visual order, preserving DOM/source order for assistive technologies.
   * @defaultValue 'end' */
  labelPosition?: 'start' | 'end'
  /** Content rendered in the free space of the checked track. It is decorative
   * (`aria-hidden`); keep the accessible label stable with `label` or `children`. */
  checkedChildren?: React.ReactNode
  /** Content rendered in the free space of the unchecked track. Decorative only. */
  unCheckedChildren?: React.ReactNode
  /** Fired before a user toggle applies. Call `event.preventDefault()` to veto an
   * uncontrolled change; controlled consumers accept by updating `checked`. */
  onStateChange?: (event: StateChangeEvent, detail: { next: boolean; prev: boolean }) => void
  /** Native post-apply `change` event. */
  onChange?: (event: Event) => void
  /** Post-apply callback with the new form-relevant value snapshot. */
  onValueChange?: (event: Event, attrs: SwitchChangeAttrs) => void
}

/**
 * Switch — a binary control for a setting that takes effect immediately. It is
 * form-associated and can be controlled with `checked` or left uncontrolled with
 * `defaultChecked`. Requires `@antadesign/anta/elements` on the client.
 */
export const Switch = ({
  checked,
  defaultChecked,
  disabled,
  tone,
  size,
  labelPosition,
  checkedChildren,
  unCheckedChildren,
  onStateChange,
  onChange,
  onValueChange,
  label,
  className,
  style,
  children,
  tabIndex,
  ...rest
}: SwitchProps) => {
  const computedStyle = toneStyle(tone, '--switch-tone-source', style)
  const explicitAriaLabel = rest['aria-label']
  const ariaLabel =
    (typeof explicitAriaLabel === 'string' ? explicitAriaLabel : undefined) ??
    label ??
    (typeof children === 'string' ? children : undefined)

  const onstatechange = onStateChange
    ? (event: StateChangeEvent) => {
        const { event: nativeEvent, detail } = nativeStateChange<StateDetail>(event)
        if (!detail) return
        onStateChange(nativeEvent, {
          next: detail.next === 'checked',
          prev: detail.prev === 'checked',
        })
      }
    : undefined

  const onchange =
    onChange || onValueChange
      ? (event: Event) => {
          onChange?.(event)
          onValueChange?.(event, switchAttrsOf(event.currentTarget))
        }
      : undefined

  const stateAttr = checked === undefined ? undefined : checked ? 'checked' : 'unchecked'
  const defaultStateAttr =
    checked === undefined && defaultChecked !== undefined
      ? defaultChecked ? 'checked' : 'unchecked'
      : undefined
  const hasLabel = label != null || children != null

  return (
    <a-switch
      role="switch"
      aria-disabled={disabled ? 'true' : undefined}
      aria-label={ariaLabel}
      {...rest}
      state={stateAttr}
      default-state={defaultStateAttr}
      disabled={disabled ? '' : undefined}
      tone={tone && tone !== 'brand' ? tone : undefined}
      size={size && size !== 'medium' ? size : undefined}
      label-position={labelPosition && labelPosition !== 'end' ? labelPosition : undefined}
      tabIndex={disabled ? -1 : (tabIndex ?? 0)}
      onstatechange={onstatechange}
      onchange={onchange}
      class={className}
      style={computedStyle}
    >
      {checkedChildren != null && (
        <a-switch-checked-content aria-hidden="true">{checkedChildren}</a-switch-checked-content>
      )}
      {unCheckedChildren != null && (
        <a-switch-unchecked-content aria-hidden="true">{unCheckedChildren}</a-switch-unchecked-content>
      )}
      {hasLabel && <a-switch-label>{label}{children}</a-switch-label>}
    </a-switch>
  )
}
