// Hooks come from the jsx-runtime indirection (configurable via `configure()`),
// not a hard `react` import — same rule as RadioGroup. Select is a *composed*
// component: it holds selection + open state and renders an <Input> trigger
// followed by a <Menu> of options. There is no `a-select` element — the wrapper
// IS the coordinator (see the Select docs page: "Components composition").
import { useState } from '../jsx-runtime'
import type { BaseProps } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import { Input } from './Input'
import { Icon } from './Icon'
import { Menu } from './Menu'
import { MenuItem } from './MenuItem'
import { MenuSeparator } from './MenuSeparator'
import styles from './Select.module.css'


/** One option in a `<Select>`. Pass a bare string as shorthand for
 *  `{ value: s, label: s }`. */
export interface SelectOption {
  /** The option's value — its identity and what `onValueChange` reports. */
  value: string
  /** Visible label. Defaults to `value`. */
  label?: string
  /** Secondary text under the label (the option row's `hint`). */
  hint?: string
  /** Leading icon (renders after the selection indicator, if any). */
  icon?: IconShape
  /** Disable just this option. */
  disabled?: boolean
  /** Tone for this option's row (label, icon, hint, selected tint, and the
   *  checkbox/radio indicator). A named tone or a custom CSS color. */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
}

/** Snapshot passed as the 2nd argument to `onValueChange` — describes *what
 *  changed*, alongside the new full value in the 1st argument. */
export interface SelectChangeAttrs {
  /** The option value that changed — the chosen value (single) or the toggled
   *  row (multiple). Omitted for a "Select all" change. */
  value?: string
  /** The resolved option object for `value`. Omitted for "Select all". */
  option?: SelectOption
  /** Multiple only: whether the change turned selection **on** (true) or off. */
  selected?: boolean
  /** Multiple only: true when the change came from the "Select all" row. */
  all?: boolean
}

/** Props shared by both selection modes, intersected into `SelectProps`. Exported
 *  (and kept as an interface intersected — not a union base via `extends`) so its
 *  members read as `Select`'s *own* props in the generated docs, not inherited. */
export interface SelectCommonProps extends Omit<BaseProps, 'children'> {
  /** The options to choose from — bare strings or `SelectOption` objects. */
  options: (SelectOption | string)[]
  /** The per-row mark for **single**-select: `'none'` (a tint-only highlight),
   *  `'check'` (a trailing checkmark on the selected row, keeping the tint — the
   *  canonical Select look), or `'radio'` (a leading radio on every row).
   *  Multi-select always uses checkboxes.
   *  @defaultValue none */
  indicator?: 'none' | 'check' | 'radio'
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
  status?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
  /** Glyph shown before the `hint` when `status` is set (Input's `statusIcon`).
   *  Each status has a default; pass a shape to override, or `false` to drop it. */
  statusIcon?: IconShape | (string & {}) | false
  /** Round the field corners — `true` for fully round, or a number / CSS length. */
  round?: boolean | number | string
  /** Disable the whole select. */
  disabled?: boolean
  /** Tone applied to the **selected** row(s) — the whole row takes this tone
   *  (label, icon, indicator, and the background tint), like passing `tone` to just
   *  the chosen option. A named tone or a custom CSS color. Most visible with the
   *  tint-based marks (`indicator` `'none'` / `'check'`); with `'radio'` /
   *  `'checkbox'` it tones the label + indicator (those modes have no row tint). */
  toneSelected?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** `multiple` only: add a "Select all" row at the top that toggles every enabled
   *  option; its box shows the mixed state when only some are selected. */
  selectAll?: boolean
  /** Label for the `selectAll` row.
   *  @defaultValue Select all */
  selectAllLabel?: string
}

/**
 * `<Select>` props. `selection` discriminates the value shape: single mode
 * (`value: string`) or `multiple` (`value: string[]`).
 */
export type SelectProps = SelectCommonProps &
  (
    | {
        /** Selection mode. `'single'` (the default) keeps `value` a string and
         *  closes the menu on pick. Switch to `'multiple'` for checkboxes + an
         *  array value.
         *  @defaultValue single */
        selection?: 'single'
        /** Controlled value. When provided, the consumer owns selection: the field
         *  follows this prop and a pick only *requests* a change via `onValueChange`
         *  (reject by not updating). Leave undefined for uncontrolled. */
        value?: string
        /** Initial value for the uncontrolled case (the wrapper then owns it). */
        defaultValue?: string
        /** Fires after the selection changes, with the new value and a
         *  `{ value, option }` snapshot. Select has no discrete element state, so
         *  there is no cancelable `onStateChange` (see the Input event-model note). */
        onValueChange?: (value: string, attrs: SelectChangeAttrs) => void
      }
    | {
        /** Multi-select: checkboxes on every row, the menu stays open while
         *  toggling, the field shows an "N selected" count, and `value` is an array. */
        selection: 'multiple'
        /** Controlled values (see the single-select `value` note). */
        value?: string[]
        /** Initial values for the uncontrolled case. */
        defaultValue?: string[]
        /** Fires after any toggle, with the new value array and a `{ value, option,
         *  selected }` snapshot of the row that changed (or `{ all: true }` for the
         *  Select-all row). */
        onValueChange?: (value: string[], attrs: SelectChangeAttrs) => void
      }
  )

const normalize = (o: SelectOption | string): SelectOption =>
  typeof o === 'string' ? { value: o, label: o } : o

/**
 * `<Select>` — a single- or multi-select dropdown, composed from `<Input>` (a
 * read-only trigger) and `<Menu>` (the options). `selection` sets behaviour:
 * `'single'` (default; `value` is a string, menu closes on pick) or `'multiple'`
 * (checkboxes, `value` is a string array, menu stays open while toggling, the
 * field shows an "N selected" count). For single-select, `indicator` picks the
 * per-row mark: `'none'` (tint only, default), `'check'` (trailing checkmark), or
 * `'radio'` (leading radio).
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
export const Select = (props: SelectProps) => {
  // External API is a discriminated union (value typed by `selection`); internally
  // we treat it loosely — `multiple` branches at runtime.
  const {
    options,
    selection,
    indicator,
    value,
    defaultValue,
    onValueChange,
    placeholder,
    label,
    hint,
    size,
    status,
    statusIcon,
    round,
    disabled,
    toneSelected,
    selectAll,
    selectAllLabel = 'Select all',
    className,
    style,
    ...rest
  } = props

  const multiple = selection === 'multiple'
  // Multi-select always uses checkboxes; single-select's mark is the `indicator`
  // prop ('none' → no per-row mark, just the tint).
  const mark = multiple ? 'checkbox' : indicator ?? 'none'
  const menuItemIndicator = mark === 'none' ? undefined : mark
  const emit = onValueChange as ((value: any, attrs: SelectChangeAttrs) => void) | undefined

  const controlled = value !== undefined
  // Uncontrolled selection lives here (component state re-render is allowed where
  // element DOM mutation isn't). `open` drives the chevron + aria-expanded.
  const [internal, setInternal] = useState<string | string[] | undefined>(defaultValue)
  const currentRaw = controlled ? value : internal
  const [open, setOpen] = useState(false)

  const opts = options.map(normalize)

  // Collapse whatever selection shape we have into a lookup list.
  const selectedValues: string[] = Array.isArray(currentRaw)
    ? currentRaw
    : currentRaw != null
      ? [currentRaw as string]
      : []
  const isSelected = (v: string) => selectedValues.includes(v)
  const labelFor = (v: string) => {
    const o = opts.find((x) => x.value === v)
    return o?.label ?? o?.value ?? v
  }

  // Trigger text: single shows the chosen label; multiple shows the one label or a
  // count summary; empty falls through to the placeholder.
  let display = ''
  if (multiple) {
    if (selectedValues.length === 1) display = labelFor(selectedValues[0])
    else if (selectedValues.length > 1) display = `${selectedValues.length} selected`
  } else if (selectedValues.length) {
    display = labelFor(selectedValues[0])
  }

  const choose = (o: SelectOption) => {
    if (multiple) {
      const has = selectedValues.includes(o.value)
      const next = has ? selectedValues.filter((v) => v !== o.value) : [...selectedValues, o.value]
      if (!controlled) setInternal(next)
      emit?.(next, { value: o.value, option: o, selected: !has })
    } else {
      if (!controlled) setInternal(o.value)
      emit?.(o.value, { value: o.value, option: o })
    }
  }

  // Select-all (multiple only): toggle every enabled option. The row's box shows
  // mixed when only some are on.
  const enabledValues = opts.filter((o) => !o.disabled).map((o) => o.value)
  const allSelected = enabledValues.length > 0 && enabledValues.every((v) => selectedValues.includes(v))
  const someSelected = selectedValues.length > 0 && !allSelected
  const toggleAll = () => {
    const next = allSelected ? [] : enabledValues
    if (!controlled) setInternal(next)
    emit?.(next, { all: true, selected: !allSelected })
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
        statusIcon={statusIcon}
        round={round}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        onKeyDown={(e: any) => {
          // A read-only field doesn't synthesize a click on Enter/Space the way a
          // button does, so open the menu ourselves: a programmatic click on the
          // field fires the Menu's anchor handler (detail 0 → opens via keyboard,
          // focusing the first option). ArrowDown opens too (listbox pattern).
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault()
            e.currentTarget.click()
          }
        }}
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
      {/* Anchors to the field (its previous sibling); opens on click. Single-select
          closes on pick; multi-select rows carry `data-menu-open` so toggling keeps
          the menu open. We observe onStateChange only to flip the chevron +
          aria-expanded. */}
      <Menu onStateChange={(_e, { next }) => setOpen(next)}>
        {multiple && selectAll && (
          <>
            <MenuItem
              selectionIndicator="checkbox"
              selected={allSelected}
              indeterminate={someSelected}
              label={selectAllLabel}
              data-menu-open=""
              onSelect={toggleAll}
            />
            <MenuSeparator />
          </>
        )}
        {opts.map((o) => (
          <MenuItem
            key={o.value}
            selectionIndicator={menuItemIndicator}
            label={o.label ?? o.value}
            hint={o.hint}
            icon={o.icon}
            // The selected row(s) take `toneSelected` (falling back to the option's
            // own tone); everything else keeps its own tone.
            tone={isSelected(o.value) && toneSelected ? toneSelected : o.tone}
            selected={isSelected(o.value)}
            disabled={o.disabled}
            data-menu-open={multiple ? '' : undefined}
            onSelect={() => choose(o)}
          />
        ))}
      </Menu>
    </>
  )
}
