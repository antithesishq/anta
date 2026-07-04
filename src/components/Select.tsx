// Hooks come from the jsx-runtime indirection (configurable via `configure()`),
// not a hard `react` import — same rule as RadioGroup. Select is a *composed*
// component: it holds selection + open state and renders an <Input> trigger
// followed by a <Menu> of options. There is no `a-select` element — the wrapper
// IS the coordinator (see the Select docs page: "A composed component").
import { useState } from '../jsx-runtime'
import type { BaseProps } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import { Input } from './Input'
import { Icon } from './Icon'
import { Menu } from './Menu'
import { MenuItem } from './MenuItem'
import styles from './Select.module.css'

type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'

/** One option in a `<Select>`. Pass a bare string as shorthand for
 *  `{ value: s, label: s }`. */
export interface SelectOption {
  /** The option's value — its identity and what `onValueChange` reports. */
  value: string
  /** Visible label. Defaults to `value`. */
  label?: string
  /** Secondary text under the label (the option row's `hint`). */
  hint?: string
  /** Leading icon. */
  icon?: IconShape
  /** Disable just this option. */
  disabled?: boolean
  /** Tone for this option's row (label, icon, hint, selected tint). */
  tone?: Tone
}

/** Snapshot passed as the 2nd argument to `onValueChange` — the new value plus
 *  the resolved option object, so you don't re-look-it-up. */
export interface SelectChangeAttrs {
  value: string
  option: SelectOption
}

export interface SelectProps extends Omit<BaseProps, 'children'> {
  /** The options to choose from — bare strings or `SelectOption` objects. */
  options: (SelectOption | string)[]
  /** Controlled selected value. When provided, the consumer owns selection: the
   *  field follows this prop and a pick only *requests* a change via
   *  `onValueChange` (reject by not updating). Leave undefined for uncontrolled. */
  value?: string
  /** Initial value for the uncontrolled case (the wrapper then owns selection). */
  defaultValue?: string
  /** Fires after the selection changes, with the new `value` and a `{ value,
   *  option }` snapshot. The single selection callback — Select has no discrete
   *  element state, so there is no cancelable `onStateChange` (see the Select /
   *  Input docs on the event model). */
  onValueChange?: (value: string, attrs: SelectChangeAttrs) => void
  /** Text shown when nothing is selected. */
  placeholder?: string
  /** Field label, above the trigger (Input's `label`). */
  label?: string
  /** Helper text under the field (Input's `hint`). */
  hint?: string
  /** Field size.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Validation/feedback tone for the field (Input's `status`).
   *  @defaultValue neutral */
  status?: Tone
  /** Round the field corners — `true` for fully round, or a number / CSS length. */
  round?: boolean | number | string
  /** Disable the whole select. */
  disabled?: boolean
}

const normalize = (o: SelectOption | string): SelectOption =>
  typeof o === 'string' ? { value: o, label: o } : o

/**
 * `<Select>` — a single-select dropdown, composed from `<Input>` (a read-only
 * trigger showing the chosen label + a chevron) and `<Menu>` (the options). The
 * `Menu` anchors to the field (its previous sibling), opens on click, closes on
 * select; the chosen row is highlighted via `MenuItem`'s `selected`.
 *
 * Controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`). There
 * is no `a-select` element — this wrapper is the coordinator; for a non-React
 * equivalent, hand-compose the same pieces (see the docs).
 *
 * Requires `@antadesign/anta/elements` (client-side only).
 *
 * @example
 * ```tsx
 * <Select
 *   label="Field"
 *   options={['output_text', 'stream', 'container']}
 *   defaultValue="stream"
 *   onValueChange={(v) => console.log(v)}
 * />
 * ```
 */
export const Select = ({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  label,
  hint,
  size,
  status,
  round,
  disabled,
  className,
  style,
  ...rest
}: SelectProps) => {
  const controlled = value !== undefined
  // Uncontrolled selection lives here (component state re-render is allowed where
  // element DOM mutation isn't). `open` drives the chevron + aria-expanded.
  const [internal, setInternal] = useState<string | undefined>(defaultValue)
  const current = controlled ? value : internal
  const [open, setOpen] = useState(false)

  const opts = options.map(normalize)
  const selected = opts.find((o) => o.value === current)
  const display = selected?.label ?? selected?.value ?? ''

  const choose = (o: SelectOption) => {
    if (!controlled) setInternal(o.value)
    onValueChange?.(o.value, { value: o.value, option: o })
  }

  return (
    <>
      <Input
        label={label}
        hint={hint}
        placeholder={placeholder}
        value={display}
        readOnly
        dimActions
        disabled={disabled}
        size={size}
        status={status}
        round={round}
        aria-haspopup="listbox"
        aria-expanded={open ? 'true' : 'false'}
        trailing={
          // Chevron rotates down → up when open (spacing + rotation in the CSS
          // module, matching the Input "Select dropdown" example).
          <Icon
            shape="chevron-down"
            className={open ? `${styles.chevron} ${styles.open}` : styles.chevron}
          />
        }
        className={className}
        style={style}
        {...rest}
      />
      {/* Anchors to the field (its previous sibling); opens on click, closes on
          select. A root menu is never narrower than its trigger by default, so it
          matches the field width. Uncontrolled — we observe onStateChange only to
          flip the chevron + aria-expanded. */}
      <Menu onStateChange={(_e, { next }) => setOpen(next)}>
        {opts.map((o) => (
          <MenuItem
            key={o.value}
            label={o.label ?? o.value}
            hint={o.hint}
            icon={o.icon}
            tone={o.tone}
            selected={o.value === current}
            disabled={o.disabled}
            onSelect={() => choose(o)}
          />
        ))}
      </Menu>
    </>
  )
}
