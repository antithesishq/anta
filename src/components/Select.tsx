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
import { MenuGroup } from './MenuGroup'
import { MenuSeparator } from './MenuSeparator'
import { Tooltip } from './Tooltip'
import styles from './Select.module.css'

// macOS labels the isolate accelerator ⌥ (Option); every other platform, Alt.
// `altKey` fires for both at runtime — only the *hint* wording differs.
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent || '')


/** One option in a `<Select>`. Pass a bare string as shorthand for
 *  `{ value: s, label: s }`. Carries an index signature so you can attach
 *  arbitrary fields (a `ranAt` date, a `status`, …) and read them back in
 *  `renderOption`; the built-in filter still matches on `value`/`label`/`hint`. */
export interface SelectOption {
  /** The option's value — its identity, what `value` / `defaultValue` name, and what
   *  `onValueChange` reports. Unique across the whole `options` tree (selection is
   *  value-keyed and global across groups / submenus). */
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
  /** Tooltip for this option's row — a string or any node. In a `multiple`
   *  select with `selectAll`, a row with no `tooltip` falls back to a default
   *  hint for the Alt/Option-click "select only this" accelerator; set `tooltip`
   *  to override that, or `''` to suppress it. */
  tooltip?: React.ReactNode
  /** Your own data — attach anything and read it in `renderOption`. */
  [key: string]: unknown
}

/** A titled group of options rendered **inline** under a heading (like `MenuGroup`).
 *  Selection stays global — a group only organizes; its heading isn't selectable.
 *  `disabled` cascades to every descendant. Nest groups / submenus freely. */
export interface SelectGroup {
  /** The section heading (non-interactive). */
  label: string
  /** The grouped items — options, or further groups / submenus. */
  options: SelectItem[]
  /** Disable the whole group (cascades to all descendants). */
  disabled?: boolean
}

/** A titled branch whose items live behind a **flyout** (like `MenuItem submenu`).
 *  Navigation only — the parent row opens the submenu and is never itself selectable.
 *  While a filter query is active the tree flattens and a submenu collapses into a
 *  group (its `label` becomes the heading). `disabled` cascades to descendants. */
export interface SelectSubmenu {
  /** The parent row's label — and the group heading when filtering flattens it. */
  label: string
  /** Leading icon on the parent row. */
  icon?: IconShape
  /** The submenu's items — options, or further groups / submenus. */
  submenu: SelectItem[]
  /** Disable the whole branch (cascades to all descendants). */
  disabled?: boolean
}

/** One entry in `options`: a plain option (string shorthand or `SelectOption`), an
 *  inline `SelectGroup`, or a flyout `SelectSubmenu`. Discriminated by shape — an
 *  `options` array is a group, a `submenu` array is a submenu, else it's an option.
 *  (`options` / `submenu` are therefore reserved keys on an option object.) */
export type SelectItem = string | SelectOption | SelectGroup | SelectSubmenu

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

/** Snapshot passed to `renderEmpty` when the option list (after any active
 *  filter) is empty. `query` discriminates the cause: non-empty means the filter
 *  hid everything; empty means there were no options to begin with (where the
 *  consumer's own external loading state, if any, decides "loading" vs "empty"). */
export interface EmptyState {
  /** The current filter query, trimmed ('' when there's no filter, nothing typed,
   *  or simply no options). */
  query: string
}

/** Snapshot passed to `renderTrigger` so a custom trigger can reflect the current
 *  selection and open state. */
export interface TriggerState {
  /** Whether the menu is open — use it for `aria-expanded` and a chevron. */
  open: boolean
  /** The current selection: a string (single), a string array (`multiple`), or
   *  `undefined` when nothing is chosen. */
  value: string | string[] | undefined
  /** The resolved option objects for the current selection (empty when none).
   *  `selected.length` is the multi-select count. */
  selected: SelectOption[]
  /** Whether the whole select is disabled. */
  disabled: boolean
  /** The `icon` shape passed to `Select`, if any — hand it to your trigger
   *  (e.g. a `Button`'s `icon`) so a custom trigger keeps the same leading glyph. */
  icon?: IconShape
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
  /** The options to choose from — bare strings, `SelectOption` objects, `SelectGroup`s
   *  (inline titled sections), or `SelectSubmenu`s (flyout branches). Groups and
   *  submenus nest and mix with plain options. Selection stays global (one `value`,
   *  leaf options only); a filter query flattens the tree into grouped results.
   *
   *  Each leaf `value` is the option's identity and must be **unique across the whole
   *  tree** — selection is value-keyed, so a value repeated in two sections is one
   *  logical pick (both rows toggle together; the trigger resolves to the last). Dev
   *  builds `console.warn` on a duplicate. */
  options: SelectItem[]
  /** The per-row mark for **single**-select: `'none'` (a tint-only highlight),
   *  `'check'` (a trailing checkmark on the selected row, keeping the tint — the
   *  canonical Select look), or `'radio'` (a leading radio on every row).
   *  Multi-select always uses checkboxes.
   *  @defaultValue none */
  indicator?: 'none' | 'check' | 'radio'
  /** Text shown when nothing is selected. */
  placeholder?: string
  /** Leading icon shown at the left of the field (the default trigger's `Input`
   *  `leading` slot). With a custom `renderTrigger`, it's passed through as
   *  `state.icon` instead — the consumer places it. */
  icon?: IconShape
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
  /** Render your own trigger in place of the default field. Receives a
   *  `TriggerState` (`open` / `value` / `selected` / `disabled` / `icon`) to drive
   *  its look. **Return exactly one focusable element** (an Anta `Button`, say) —
   *  the menu anchors to it (its own previous DOM sibling) and opens it on click,
   *  so a fragment, multiple siblings, or a non-focusable wrapper will misanchor
   *  (the menu warns in the console if the trigger has no focusable element). Give
   *  the element `aria-haspopup="menu"` plus `aria-expanded={state.open}`. The field
   *  props (`label`, `hint`, `size`, `status`, `placeholder`, `round`) don't apply. */
  renderTrigger?: (state: TriggerState) => React.ReactNode
  /** Render content in the menu body when the (filtered) option list is empty —
   *  a "no results" message, a loading indicator (gated on your own external
   *  loading state), or a "create from the query" row. Receives an `EmptyState`
   *  (`query`, trimmed). There is no built-in empty message: when omitted, an empty
   *  list renders nothing. Whatever you return goes where the option rows would —
   *  a plain node is inert; return a `MenuItem` (e.g. a "Create" row) to make it
   *  focusable and selectable. */
  renderEmpty?: (state: EmptyState) => React.ReactNode
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
        /** Controlled value — the `value` string of the selected option. When
         *  provided, the consumer owns selection: the field follows this prop and a
         *  pick only *requests* a change via `onValueChange` (reject by not updating).
         *  Leave undefined for uncontrolled. */
        value?: string
        /** Initial value (an option's `value` string) for the uncontrolled case — the
         *  wrapper then owns it. */
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
        /** Controlled values — the `value` strings of the selected options (see the
         *  single-select `value` note). */
        value?: string[]
        /** Initial values (option `value` strings) for the uncontrolled case. */
        defaultValue?: string[]
        /** Fires after any toggle, with the new value array and a `{ value, option,
         *  selected }` snapshot of the row that changed (or `{ all: true }` for the
         *  Select-all row). */
        onValueChange?: (value: string[], attrs: SelectChangeAttrs) => void
      }
  )

const normalize = (o: SelectOption | string): SelectOption =>
  typeof o === 'string' ? { value: o, label: o } : o

/** Rolled-up selection of a group / submenu subtree: `'none'` / `'all'` of the
 *  descendant leaves selected, or `'some'` in between. On `SelectedGroup` /
 *  `SelectedSubmenu`, for a section indicator or custom styling. */
export type SelectionState = 'none' | 'some' | 'all'

/** A leaf option annotated with its current selection — a `SelectOption` plus
 *  `selected`. Returned by {@link optionsWithSelection}. */
export type SelectedOption = SelectOption & { selected: boolean }

/** A group with its descendants annotated and a rolled-up `selectionState`.
 *  Returned by {@link optionsWithSelection}. */
export interface SelectedGroup extends Omit<SelectGroup, 'options'> {
  options: SelectedItem[]
  selectionState: SelectionState
}

/** A submenu with its descendants annotated and a rolled-up `selectionState`.
 *  Returned by {@link optionsWithSelection}. */
export interface SelectedSubmenu extends Omit<SelectSubmenu, 'submenu'> {
  submenu: SelectedItem[]
  selectionState: SelectionState
}

/** One node of the tree from {@link optionsWithSelection}: a leaf `SelectedOption`
 *  (with `selected`), or a `SelectedGroup` / `SelectedSubmenu` (annotated children
 *  + rolled-up `selectionState`). Mirrors `SelectItem` minus the bare-string
 *  shorthand — strings are normalized to `SelectedOption`. */
export type SelectedItem = SelectedOption | SelectedGroup | SelectedSubmenu

/**
 * Project a `Select` `options` tree onto a set of selected values: returns a mirror
 * of the tree with every leaf marked `selected` and every group / submenu carrying a
 * rolled-up `selectionState` (`'none'` / `'some'` / `'all'` of its descendant leaves).
 * Bare-string options are normalized to `{ value, label }`; structure and order are
 * preserved.
 *
 * A pure function of `(options, values)` — it needs no `Select` instance and reads
 * nothing off the change event, so it behaves identically in controlled and
 * uncontrolled code. Pass the current `value` (a string, an array, or `undefined`)
 * and render a grouped summary, drive section indicators, or diff picks.
 *
 * A value that appears under more than one section marks the leaf in *every* place it
 * occurs (selection is value-keyed), mirroring how the menu itself renders it.
 *
 * @example
 * ```tsx
 * const tree = optionsWithSelection(options, values)
 * // tree[1] === { label: 'Engineering', selectionState: 'some', options: [
 * //   { value: 'eng-fe', label: 'Frontend', selected: false }, … ] }
 * ```
 */
export function optionsWithSelection(
  options: SelectItem[],
  values: string | string[] | undefined,
): SelectedItem[] {
  const set = new Set<string>(values == null ? [] : Array.isArray(values) ? values : [values])

  const rollUp = (items: SelectedItem[]): SelectionState => {
    let total = 0
    let on = 0
    const count = (its: SelectedItem[]) => {
      for (const it of its) {
        if (Array.isArray((it as SelectedSubmenu).submenu)) count((it as SelectedSubmenu).submenu)
        else if (Array.isArray((it as SelectedGroup).options)) count((it as SelectedGroup).options)
        else {
          total++
          if ((it as SelectedOption).selected) on++
        }
      }
    }
    count(items)
    return on === 0 ? 'none' : on === total ? 'all' : 'some'
  }

  const walk = (items: SelectItem[]): SelectedItem[] =>
    items.map((raw): SelectedItem => {
      if (typeof raw !== 'string' && Array.isArray((raw as SelectSubmenu).submenu)) {
        const sm = raw as SelectSubmenu
        const submenu = walk(sm.submenu)
        return { ...sm, submenu, selectionState: rollUp(submenu) }
      }
      if (typeof raw !== 'string' && Array.isArray((raw as SelectGroup).options)) {
        const g = raw as SelectGroup
        const opts = walk(g.options)
        return { ...g, options: opts, selectionState: rollUp(opts) }
      }
      const o = normalize(raw as SelectOption | string)
      return { ...o, selected: set.has(o.value) }
    })

  return walk(options)
}

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
    icon,
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
    renderTrigger,
    renderEmpty,
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
  // Combobox active-option id, reported by the menu's `activedescendant` event.
  // Select (the reactive layer that owns the filter field) reflects it onto the
  // field's `aria-activedescendant` — the element must not write that light-DOM
  // attribute itself.
  const [activeId, setActiveId] = useState<string | null>(null)
  const uid = useId()

  // Discriminate an `options` entry by shape: a `submenu` array → flyout branch, an
  // `options` array → inline group, otherwise a leaf option.
  const isSubmenu = (it: SelectItem): it is SelectSubmenu =>
    typeof it === 'object' && Array.isArray((it as SelectSubmenu).submenu)
  const isGroup = (it: SelectItem): it is SelectGroup =>
    typeof it === 'object' && Array.isArray((it as SelectGroup).options)

  // Flatten the tree to its leaf options once, carrying each leaf's *effective*
  // disabled (cascaded from any group/submenu ancestor) and its immediate parent's
  // label (the heading a filter query flattens it under). Everything value-shaped —
  // `byValue`, the selection count, Select-all — reads this flat list; only
  // rendering walks the tree.
  interface Leaf { opt: SelectOption; disabled: boolean; group?: string }
  const collectLeaves = (items: SelectItem[], group: string | undefined, disabled: boolean, out: Leaf[]) => {
    for (const raw of items) {
      if (typeof raw !== 'string' && isSubmenu(raw)) collectLeaves(raw.submenu, raw.label, disabled || !!raw.disabled, out)
      else if (typeof raw !== 'string' && isGroup(raw)) collectLeaves(raw.options, raw.label, disabled || !!raw.disabled, out)
      else {
        const o = normalize(raw)
        out.push({ opt: o, disabled: disabled || !!o.disabled, group })
      }
    }
  }
  const allLeaves: Leaf[] = []
  collectLeaves(options, undefined, false, allLeaves)
  // A value is an option's identity across the whole tree — selection is global, so a
  // value repeated in two sections is one logical pick. Warn on duplicates (like
  // <Tabs> / RadioGroup, a bare console.warn that only fires on the bug): they collapse
  // into a single selection — `byValue` keeps the last, and every row sharing the value
  // selects/toggles together.
  const seenValues = new Set<string>()
  for (const l of allLeaves) {
    if (seenValues.has(l.opt.value))
      console.warn(`[anta] <Select> duplicate option value=${JSON.stringify(l.opt.value)} — values must be unique.`)
    seenValues.add(l.opt.value)
  }
  const byValue = new Map(allLeaves.map((l) => [l.opt.value, l.opt]))

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
      ? filter(o, q)
      : !queryRe || [o.value, o.label ?? '', o.hint ?? ''].some((s) => queryRe.test(s))
  // Which leaves survive the filter. A custom filter *function* prunes on every
  // render (even with an empty query), so a predicate that filters by a criterion —
  // not the typed text — always applies. The built-in matcher only prunes once
  // something is typed (empty query = show all; a text function matches '' → all).
  const prune = typeof filter === 'function' || (filtering && !!q)
  const visibleLeaves = prune ? allLeaves.filter((l) => matches(l.opt)) : allLeaves
  // A typed query flattens the tree into grouped results; with no query we render
  // the tree (inline groups + submenu flyouts). A function filter prunes in place.
  const flattening = filtering && !!q

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

  const choose = (o: SelectOption, e?: any) => {
    if (multiple) {
      // Alt/Option-click isolates the row: clear the rest and select only this
      // one — the inverse of Select all, with no visible affordance (the row's
      // hint tooltip below teaches it). Gated on `selectAll`, the bulk-selection
      // context where "isolate" is the natural companion. `altKey` covers Alt and
      // macOS Option, and sidesteps the Ctrl-click / context-menu clash.
      if (selectAll && e?.altKey) {
        const next = [o.value]
        if (!controlled) setInternal(next)
        emit?.(next, { value: o.value, option: o, selected: true })
        return
      }
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
  const enabledValues = multiple ? visibleLeaves.filter((l) => !l.disabled).map((l) => l.opt.value) : []
  const enabledSelected = enabledValues.filter((v) => selectedValues.includes(v))
  const allSelected = enabledValues.length > 0 && enabledSelected.length === enabledValues.length
  const someSelected = enabledSelected.length > 0 && !allSelected
  const toggleAll = () => {
    const keep = selectedValues.filter((v) => !enabledValues.includes(v))
    const next = allSelected ? keep : [...keep, ...enabledValues]
    if (!controlled) setInternal(next)
    emit?.(next, { all: true, selected: !allSelected })
  }

  // One option row. `disabled` is the leaf's *effective* disabled (cascaded).
  const renderOptionRow = (o: SelectOption, disabled: boolean) => {
    const optState: OptionState = { value: o.value, selected: isSelected(o.value), disabled }
    const custom = renderOption?.(o, optState)
    const customMark = renderIndicator?.(optState)
    // Default single-select (`indicator="none"`) has no checkable role, so expose the
    // choice to AT as a `menuitemradio` + `aria-checked` (single-select is radio
    // semantics); the mark stays invisible. Other modes set this via selectionIndicator.
    const ariaSelectable =
      !multiple && mark === 'none'
        ? { role: 'menuitemradio', 'aria-checked': isSelected(o.value) ? 'true' : 'false' }
        : undefined
    // Row tooltip: the option's own `tooltip`, else — in a `multiple` + `selectAll`
    // menu, on an enabled row — the default Alt/Option-click isolate hint. A
    // `tooltip=""` stays empty (falsy → no bubble), which is how a consumer opts a
    // row out of the default hint.
    const isolateHint =
      multiple && selectAll && !disabled
        ? IS_MAC
          ? '⌥+Click to select only this'
          : 'Alt+Click to select only this'
        : undefined
    const tip = o.tooltip ?? isolateHint
    // The default hint teaches an accelerator, so it's unobtrusive: a longer delay
    // than the 250ms default (it shouldn't fire on a casual pass over the rows) and
    // it follows the cursor. A consumer's own `tooltip` keeps the default pinned look.
    const hintOnly = o.tooltip == null && isolateHint != null
    return (
      <MenuItem
        key={o.value}
        id={`${uid}-opt-${o.value}`}
        selectionIndicator={menuItemIndicator}
        {...ariaSelectable}
        indicator={customMark ?? undefined}
        label={custom ? undefined : queryRe ? highlight(o.label ?? o.value) : o.label ?? o.value}
        hint={custom ? undefined : queryRe && o.hint ? highlight(o.hint) : o.hint}
        icon={custom ? undefined : o.icon}
        tone={o.tone}
        toneSelected={toneSelected}
        selected={isSelected(o.value)}
        disabled={disabled || undefined}
        data-menu-open={multiple ? '' : undefined}
        onSelect={(e: any) => choose(o, e)}
      >
        {custom}
        {tip && (
          <Tooltip {...(hintOnly ? { follow: true, delay: 700 } : {})}>{tip}</Tooltip>
        )}
      </MenuItem>
    )
  }

  // Idle render: walk the tree. Groups render inline (`MenuGroup`), submenus as
  // flyouts (`MenuItem submenu` + nested `Menu`). A function filter prunes leaves in
  // place; a container with no surviving descendant is dropped so no empty flyout
  // or heading shows.
  const renderTree = (items: SelectItem[], disabled: boolean): React.ReactNode[] => {
    const out: React.ReactNode[] = []
    items.forEach((raw, i) => {
      if (typeof raw !== 'string' && isSubmenu(raw)) {
        const dis = disabled || !!raw.disabled
        const inner = renderTree(raw.submenu, dis)
        if (inner.length)
          out.push(
            <MenuItem
              key={`sub-${i}-${raw.label}`}
              submenu
              label={raw.label}
              icon={raw.icon}
              disabled={dis || undefined}
              data-menu-open={multiple ? '' : undefined}
            >
              <Menu>{inner}</Menu>
            </MenuItem>,
          )
        return
      }
      if (typeof raw !== 'string' && isGroup(raw)) {
        const dis = disabled || !!raw.disabled
        const inner = renderTree(raw.options, dis)
        if (inner.length) out.push(<MenuGroup key={`grp-${i}-${raw.label}`} label={raw.label}>{inner}</MenuGroup>)
        return
      }
      const o = normalize(raw)
      if (typeof filter === 'function' && !matches(o)) return
      out.push(renderOptionRow(o, disabled || !!o.disabled))
    })
    return out
  }

  // Flattened render (a query is active): matching leaves grouped by their immediate
  // parent label — a submenu collapses into a `MenuGroup`, top-level options stay
  // ungrouped. DFS order is preserved; consecutive same-label leaves share a group.
  const renderFlat = (): React.ReactNode[] => {
    const shown = allLeaves.filter((l) => matches(l.opt))
    const out: React.ReactNode[] = []
    for (let i = 0; i < shown.length; ) {
      const label = shown[i].group
      if (label === undefined) {
        out.push(renderOptionRow(shown[i].opt, shown[i].disabled))
        i++
        continue
      }
      const rows: React.ReactNode[] = []
      const start = i
      while (i < shown.length && shown[i].group === label) {
        rows.push(renderOptionRow(shown[i].opt, shown[i].disabled))
        i++
      }
      out.push(<MenuGroup key={`flat-${start}-${label}`} label={label}>{rows}</MenuGroup>)
    }
    return out
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ open, value: currentRaw, selected: selectedOptions, disabled: !!disabled, icon })
      ) : (
      <Input
        label={label}
        hint={hint}
        placeholder={placeholder}
        value={display}
        readOnly
        dimActions
        disabled={disabled}
        leading={icon ? <Icon shape={icon} /> : undefined}
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
      )}
      {/* Anchors to the trigger (its previous sibling); opens on click. Single-select
          closes on pick; multi-select rows carry `data-menu-open` so toggling keeps
          the menu open. We observe onStateChange to flip the chevron / aria-expanded
          and to reset the filter when the menu closes. */}
      <Menu
        onStateChange={(_e, { next }) => {
          setOpen(next)
          if (!next) { setQuery(''); setActiveId(null) } // closed → clear filter + cursor
        }}
        onactivedescendant={(e: any) => setActiveId(((e.nativeEvent ?? e).detail?.id) ?? null)}
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
              // Reflect the menu's reported cursor (in-sync — Select owns this
              // field), rather than the element writing this light-DOM attribute.
              aria-activedescendant={open && activeId ? activeId : undefined}
              onInput={(e: any) => setQuery(e.currentTarget.value)}
            />
          </div>
        )}
        {multiple && selectAll && visibleLeaves.length > 0 && (
          <>
            <MenuItem
              selectionIndicator="checkbox"
              selected={allSelected}
              indeterminate={someSelected}
              label={selectAllLabel}
              data-menu-open=""
              // Keep the combobox's typed-query cursor off this action row — it
              // seats on the first real option instead (still arrow-reachable).
              data-menu-skip-active=""
              onSelect={toggleAll}
            />
            <MenuSeparator />
          </>
        )}
        {/* No built-in empty copy: only what `renderEmpty` returns (nothing when it's
            absent). Otherwise the tree (inline groups + submenu flyouts) when idle, or
            the flattened grouped results while a query narrows it. */}
        {visibleLeaves.length === 0
          ? renderEmpty?.({ query: q })
          : flattening
            ? renderFlat()
            : renderTree(options, false)}
      </Menu>
    </>
  )
}
