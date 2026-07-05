// Hooks come from the jsx-runtime indirection (configurable via `configure()`),
// not a hard `react` import — same rule as RadioGroup. Select is a *composed*
// component: it holds selection + open state and renders an <Input> trigger
// followed by a <Menu> of options. There is no `a-select` element — the wrapper
// IS the coordinator (see the Select docs page: "Components composition").
import { useState, useId } from '../jsx-runtime'
import type { BaseProps } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import { Input } from './Input'
import { Icon } from './Icon'
import { Menu } from './Menu'
import { MenuItem } from './MenuItem'
import { MenuSeparator } from './MenuSeparator'
import styles from './Select.module.css'


/** One option in a `<Select>`. Pass a bare string as shorthand for
 *  `{ value: s, label: s }`. Carries an index signature so you can attach
 *  arbitrary fields (a `ranAt` date, a `status`, …) and read them back in
 *  `renderOption`; the built-in filter still matches on `value`/`label`/`hint`. */
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
  /** Your own data — attach anything and read it in `renderOption`. */
  [key: string]: unknown
}

/** Per-row snapshot passed to `renderOption` / `renderIndicator`. Everything here
 *  is known at render time; the combobox "active" cursor is deliberately absent
 *  (it's a live element state the DOM owns, not a render-time value). */
export interface OptionState {
  /** The option's value. */
  value: string
  /** Whether this row is currently selected. */
  selected: boolean
  /** Whether this row is disabled. */
  disabled: boolean
}

/** Snapshot passed as the 2nd argument to `onValueChange` — describes *what*
 *  changed, alongside the new full value in the 1st argument. A discriminated
 *  union: a row toggle carries `value` + `option`; the "Select all" row carries
 *  `all: true` instead. Narrow on `'all' in attrs` before reading `option`. */
export type SelectChangeAttrs =
  | {
      /** The option value that changed — the chosen value (single) or the toggled
       *  row (multiple). */
      value: string
      /** The resolved option object for `value`. */
      option: SelectOption
      /** Multiple only: whether the change turned selection **on** (true) or off. */
      selected?: boolean
    }
  | {
      /** Marks the change as coming from the "Select all" row (multiple only). */
      all: true
      /** Whether Select-all turned everything **on** (true) or cleared it. */
      selected: boolean
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
  /** Add a search field at the top of the menu that filters the options as you
   *  type. `true` uses the built-in matcher — a case-insensitive substring of the
   *  option's **value / label / hint**. Pass a **function** `(option, query) =>
   *  boolean` for custom matching (called per option; return `true` to keep it). */
  filter?: boolean | ((option: SelectOption, query: string) => boolean)
  /** `multiple` only: add a "Select all" row at the top that toggles every enabled
   *  option (the currently-visible ones when a `filter` query is active); its box
   *  shows the mixed state when only some are selected. */
  selectAll?: boolean
  /** Label for the `selectAll` row.
   *  @defaultValue Select all */
  selectAllLabel?: string
  /** Render the **content** of each option row yourself, replacing the built-in
   *  `label`/`hint`/`icon` layout. Select still supplies the row box, click, ARIA,
   *  and the selection indicator — you return only what goes *inside*. Read extra
   *  fields off the option (see `SelectOption`'s index signature) plus an
   *  `OptionState` (`value`/`selected`/`disabled`). Filtering still works (it
   *  matches the option's `value`/`label`/`hint`), but match-highlighting is
   *  skipped — your content owns its own display. */
  renderOption?: (option: SelectOption, state: OptionState) => React.ReactNode
  /** Replace each row's selection **mark** with your own node, drawn at the
   *  leading edge. The row stays the control (`role` + `aria-checked` from
   *  `indicator` / `selection`); only the drawn mark changes, so pair it with an
   *  `indicator` (`'check'` / `'radio'`) or `selection="multiple"` for the
   *  semantics. Composes with `renderOption`. */
  renderIndicator?: (state: OptionState) => React.ReactNode
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
    filter,
    selectAll,
    selectAllLabel = 'Select all',
    renderOption,
    renderIndicator,
    className,
    style,
    ...rest
  } = props

  const multiple = selection === 'multiple'
  // A validation status tints the chevron to match the field's border/hint.
  const statusColor =
    status && status !== 'neutral' ? `var(--text-2-${status})` : undefined
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
  // Filter query (reset when the menu closes — see the Menu's onStateChange).
  const [query, setQuery] = useState('')
  const uid = useId()

  const opts = options.map(normalize)
  const byValue = new Map(opts.map((o) => [o.value, o]))

  // `filter`: which options the menu shows. The built-in matcher is a regex that's
  // case-insensitive and treats each run of whitespace in the query as "one or more
  // whitespace symbols" (so a typed space spans any gap); a function is a custom
  // per-option predicate. `queryRe` is null for a function or an empty query — which
  // is also the signal to skip match-highlighting.
  const filtering = filter !== undefined && filter !== false
  const q = query.trim()
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const queryRe =
    filtering && typeof filter !== 'function' && q
      ? new RegExp(q.split(/\s+/).map(escapeRe).join('\\s+'), 'i')
      : null
  const matches = (o: SelectOption) =>
    typeof filter === 'function'
      ? filter(o, query)
      : !queryRe || [o.value, o.label ?? '', o.hint ?? ''].some((s) => queryRe.test(s))
  const visibleOpts = filtering && q ? opts.filter(matches) : opts

  // Bold the matched substring(s) for display — built-in matcher only.
  const highlight = (text: string): React.ReactNode => {
    if (!queryRe) return text
    const re = new RegExp(queryRe.source, 'gi')
    const out: React.ReactNode[] = []
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push(text.slice(last, m.index))
      out.push(<b key={out.length}>{m[0]}</b>)
      last = m.index + m[0].length
      if (m[0].length === 0) re.lastIndex++ // guard against a zero-width match looping
    }
    if (out.length === 0) return text
    if (last < text.length) out.push(text.slice(last))
    return out
  }

  // Collapse whatever selection shape we have into a lookup list.
  const selectedValues: string[] = Array.isArray(currentRaw)
    ? currentRaw
    : currentRaw != null
      ? [currentRaw as string]
      : []
  const isSelected = (v: string) => selectedValues.includes(v)
  // Only values that map to a real option row count toward the trigger — a stale or
  // unknown value contributes nothing rather than corrupting the label or the count.
  const selectedOptions = selectedValues.map((v) => byValue.get(v)).filter(Boolean) as SelectOption[]

  // Trigger text: single shows the chosen label; multiple shows the one label or a
  // count summary; nothing selectable falls through to the placeholder.
  let display = ''
  if (multiple) {
    if (selectedOptions.length === 1) display = selectedOptions[0].label ?? selectedOptions[0].value
    else if (selectedOptions.length > 1) display = `${selectedOptions.length} selected`
  } else if (currentRaw != null) {
    const o = byValue.get(currentRaw as string)
    display = o ? (o.label ?? o.value) : ''
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

  // Select-all (multiple only): toggle every *enabled* option, preserving any
  // selected disabled / unknown values (the user can't reach those to re-add them).
  // The row's box shows mixed when only some enabled options are on. Computed only
  // in multiple mode — single-select never reads it.
  const enabledValues = multiple ? visibleOpts.filter((o) => !o.disabled).map((o) => o.value) : []
  const enabledSelected = enabledValues.filter((v) => selectedValues.includes(v))
  const allSelected = enabledValues.length > 0 && enabledSelected.length === enabledValues.length
  const someSelected = enabledSelected.length > 0 && !allSelected
  const toggleAll = () => {
    const keep = selectedValues.filter((v) => !enabledValues.includes(v))
    const next = allSelected ? keep : [...keep, ...enabledValues]
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
          // Open on Enter/Space/ArrowDown, but ONLY while closed. A read-only field
          // doesn't synthesize a click, so we click it ourselves (detail 0 → the
          // Menu opens via keyboard and focuses the first option). Guarding on `open`
          // matters after a *mouse* open, where focus stays on the trigger: without
          // it, ArrowDown would re-click the still-open menu and toggle it shut.
          // While open, the key falls through to the Menu (ArrowDown enters the list).
          if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
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
            style={statusColor ? { color: statusColor } : undefined}
          />
        }
        className={className}
        style={style}
        {...rest}
      />
      {/* Anchors to the field (its previous sibling); opens on click. Single-select
          closes on pick; multi-select rows carry `data-menu-open` so toggling keeps
          the menu open. We observe onStateChange to flip the chevron / aria-expanded
          and to reset the filter when the menu closes. */}
      <Menu
        onStateChange={(_e, { next }) => {
          setOpen(next)
          if (!next) setQuery('') // closed → clear the filter for next open
        }}
      >
        {filtering && (
          // `slot="header"` pins the field in the Menu's fixed header region (above
          // the scrolling options); `data-menu-search` puts the menu in combobox
          // mode — it focuses this field on open and drives an active-option cursor.
          <div className={styles.filter} slot="header" data-menu-open="">
            <Input
              data-menu-search=""
              size="small"
              value={query}
              placeholder="Filter…"
              aria-label="Filter options"
              aria-autocomplete="list"
              leading={<Icon shape="search" />}
              onInput={(e: any) => setQuery(e.currentTarget.value)}
            />
          </div>
        )}
        {multiple && selectAll && visibleOpts.length > 0 && (
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
        {visibleOpts.length === 0 ? (
          <MenuItem disabled label="No matches" data-menu-open="" />
        ) : (
          visibleOpts.map((o) => {
            const optState: OptionState = {
              value: o.value,
              selected: isSelected(o.value),
              disabled: !!o.disabled,
            }
            // `renderOption` owns the row content (passed as `children`, replacing
            // `label`/`hint`/`icon`); `renderIndicator` owns the leading mark (passed
            // as MenuItem's `indicator`). Select still supplies the row box, click, and
            // ARIA. No match-highlighting with a custom row — its content is its own.
            const custom = renderOption?.(o, optState)
            const customMark = renderIndicator?.(optState)
            return (
              <MenuItem
                key={o.value}
                id={`${uid}-opt-${o.value}`}
                selectionIndicator={menuItemIndicator}
                indicator={customMark ?? undefined}
                label={custom ? undefined : queryRe ? highlight(o.label ?? o.value) : o.label ?? o.value}
                hint={custom ? undefined : queryRe && o.hint ? highlight(o.hint) : o.hint}
                icon={custom ? undefined : o.icon}
                // The selected row(s) take `toneSelected` (falling back to the option's
                // own tone); everything else keeps its own tone.
                tone={isSelected(o.value) && toneSelected ? toneSelected : o.tone}
                selected={isSelected(o.value)}
                disabled={o.disabled}
                data-menu-open={multiple ? '' : undefined}
                onSelect={() => choose(o)}
              >
                {custom}
              </MenuItem>
            )
          })
        )}
      </Menu>
    </>
  )
}
