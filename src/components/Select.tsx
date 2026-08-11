// Hooks come from the jsx-runtime indirection configured through `configure()`,
// as in RadioGroup. Select keeps its selection and open state, then renders an
// Input trigger followed by a Menu of options. There is no `a-select` element.
import { useState, useId } from '../jsx-runtime'
import { ISOLATE_HINT, optionPresentationAttrs } from '../anta_helpers'
import { normalizeOpt, matchQueryRegex, matchesQuery, highlight } from './select-options'
import type { BaseProps, OptionPresentationProps } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import { Input } from './Input'
import { Icon } from './Icon'
import { Menu, type MenuProps } from './Menu'
import { MenuItem } from './MenuItem'
import { MenuGroup } from './MenuGroup'
import { MenuSeparator } from './MenuSeparator'
import { Tooltip } from './Tooltip'
import './select-parts.css'


/** The type an option `value` may take: `string`, `number`, or `boolean`. Selection
 *  compares values with `===`. Object-shaped values are out of scope; give the option a
 *  stable primitive `value` and read the object back off `attrs.option` (or, in
 *  `SelectFaceted`, use a `custom` facet). */
export type OptionValue = string | number | boolean

/** One option in a `<Select>`. Pass a bare string as shorthand for
 *  `{ value: s, label: s }`. Carries an index signature so you can attach
 *  arbitrary fields (a `ranAt` date, a `status`, …) and read them back in
 *  `renderOption`; the built-in filter still matches on `value`/`label`/`hint`.
 *
 *  Generic in the value type `V` (defaults to `string`): `Select` infers `V` from your
 *  `options`, so `{ value: 365 }` round-trips as `number` through `onValueChange`. */
export interface SelectOption<V extends OptionValue = string> extends OptionPresentationProps {
  /** The option's value (`V`) — its identity, what `value` / `defaultValue` name, and
   *  what `onValueChange` reports. Unique across the whole `options` tree (selection is
   *  value-keyed and global across groups / submenus). */
  value: V
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
  /** Additional application data. Read it in `renderOption`. */
  [key: string]: unknown
}

/** A titled group of options rendered **inline** under a heading (like `MenuGroup`).
 *  Selection stays global — a group only organizes; its heading isn't selectable.
 *  `disabled` cascades to every descendant. Nest groups / submenus freely. */
export interface SelectGroup<V extends OptionValue = string> {
  /** The section heading (non-interactive). */
  label: string
  /** The grouped items — options, or further groups / submenus. */
  options: SelectItem<V>[]
  /** Disable the whole group (cascades to all descendants). */
  disabled?: boolean
}

/** A titled branch whose items live behind a **flyout** (like `MenuItem submenu`).
 *  Navigation only — the parent row opens the submenu and is never itself selectable.
 *  While a filter query is active the tree flattens and a submenu collapses into a
 *  group (its `label` becomes the heading). `disabled` cascades to descendants. */
export interface SelectSubmenu<V extends OptionValue = string> {
  /** The parent row's label — and the group heading when filtering flattens it. */
  label: string
  /** Leading icon on the parent row. */
  icon?: IconShape
  /** The submenu's items — options, or further groups / submenus. */
  submenu: SelectItem<V>[]
  /** Disable the whole branch (cascades to all descendants). */
  disabled?: boolean
}

/** One entry in `options`: a plain option (string shorthand or `SelectOption`), an
 *  inline `SelectGroup`, or a flyout `SelectSubmenu`. Discriminated by shape — an
 *  `options` array is a group, a `submenu` array is a submenu, else it's an option.
 *  (`options` / `submenu` are therefore reserved keys on an option object.) */
export type SelectItem<V extends OptionValue = string> =
  | string
  | SelectOption<V>
  | SelectGroup<V>
  | SelectSubmenu<V>

/** Per-row snapshot passed to `renderOption` / `renderIndicator`. Everything here
 *  is known at render time; the combobox "active" cursor is deliberately absent
 *  (it's a live element state the DOM owns, not a render-time value). */
export interface OptionState<V extends OptionValue = string> {
  /** The option's value. */
  value: V
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
export interface TriggerState<V extends OptionValue = string> {
  /** Whether the menu is open — use it for `aria-expanded` and a chevron. */
  open: boolean
  /** The current selection: a single value (single), an array (`multiple`), or
   *  `undefined` when nothing is chosen. */
  value: V | V[] | undefined
  /** The resolved option objects for the current selection (empty when none).
   *  `selected.length` is the multi-select count. */
  selected: SelectOption<V>[]
  /** Whether the whole select is disabled. */
  disabled: boolean
  /** The `icon` shape passed to `Select`, if any — hand it to your trigger
   *  (e.g. a `Button`'s `icon`) so a custom trigger keeps the same leading glyph. */
  icon?: IconShape
}

/** Snapshot passed as the 2nd argument to `onValueChange` — describes *what*
 *  changed, alongside the new full value in the 1st argument. A discriminated
 *  union: a row toggle carries `value` + `option`; a bulk change (the "Select all"
 *  row, or the `clearable` "Clear" footer) carries `all: true` instead. **Always
 *  narrow on `'all' in attrs` before reading `option`** — the `all` variant fires
 *  for single-select too (via `clearable`), not just multiple. */
export type SelectChangeAttrs<V extends OptionValue = string> =
  | {
      /** The option value that changed — the chosen value (single) or the toggled
       *  row (multiple). */
      value: V
      /** The resolved option object for `value`. */
      option: SelectOption<V>
      /** Multiple only: whether the change turned selection **on** (true) or off. */
      selected?: boolean
    }
  | {
      /** Marks the change as a bulk one with no single `option`: the "Select all"
       *  row (multiple), or the `clearable` "Clear" footer (single or multiple). */
      all: true
      /** Whether the bulk change turned everything **on** (true) or cleared it
       *  (false — always false for a "Clear"). */
      selected: boolean
    }

/** Props shared by both selection modes, intersected into `SelectProps`. Exported
 *  (and kept as an interface intersected — not a union base via `extends`) so its
 *  members read as `Select`'s *own* props in the generated docs, not inherited. */
export interface SelectCommonProps<V extends OptionValue = string> extends Omit<BaseProps, 'children'> {
  /** The options to choose from — bare strings, `SelectOption` objects, `SelectGroup`s
   *  (inline titled sections), or `SelectSubmenu`s (flyout branches). Groups and
   *  submenus nest and mix with plain options. Selection stays global (one `value`,
   *  leaf options only); a filter query flattens the tree into grouped results.
   *
   *  `Select` infers its value type `V` from these options: `{ value: 365 }` makes
   *  `onValueChange` report `number`. A mix of value types widens `V` to the union.
   *
   *  Each leaf `value` is the option's identity and must be **unique across the whole
   *  tree** (selection is value-keyed, so a value repeated in two sections is one logical
   *  pick: both rows toggle together, the trigger resolves to the last). Values that
   *  stringify alike (`365` and `"365"`) also collide as row keys; dev builds
   *  `console.warn` on either. */
  options: SelectItem<V>[]
  /** Preferred placement of the options menu relative to the trigger. The menu
   *  auto-flips vertically and clamps horizontally when needed.
   *  @defaultValue bottom-start */
  placement?: MenuProps['placement']
  /** Gap in pixels between the trigger and the options menu.
   *  @defaultValue 4 */
  offset?: number
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
  /** Content for the default trigger's `leading` slot, such as a key prefix
   *  before the value. It replaces the icon derived from `icon`. Include an
   *  `<Icon>` in this content when both are needed. Ignored by `renderTrigger`. */
  leading?: React.ReactNode
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
  filter?: boolean | ((option: SelectOption<V>, query: string) => boolean)
  /** `multiple` only: shows a "Select all" row that toggles every enabled option,
   *  or only the visible options when a filter query is active. Its checkbox is
   *  mixed when some options are selected. It is on by default. Set it to `false`
   *  to remove the row and the Alt/Option-click shortcut that selects only one row.
   *  @defaultValue true */
  selectAll?: boolean
  /** Label for the `selectAll` row.
   *  @defaultValue Select all */
  selectAllLabel?: string
  /** Add a "Clear" row pinned in the menu **footer** that empties the selection
   *  (single → none, multiple → `[]`). Shown only while something is selected, so
   *  it never scrolls away in a long or filtered list. */
  clearable?: boolean
  /** Label for the `clearable` footer row.
   *  @defaultValue Clear */
  clearLabel?: string
  /** Replaces the built-in `label`, `hint`, and `icon` layout for each option row.
   *  Select still supplies the row container, click handling, ARIA attributes, and
   *  selection indicator. Read extra option fields through `SelectOption`'s index
   *  signature. `state` contains `value`, `selected`, and `disabled`. Filtering
   *  still matches the option's `value`, `label`, and `hint`, but Select cannot
   *  highlight matches within the returned content. */
  renderOption?: (option: SelectOption<V>, state: OptionState<V>) => React.ReactNode
  /** Replace each row's selection **mark** with your own node, drawn at the
   *  leading edge. The row stays the control (`role` + `aria-checked` from
   *  `indicator` / `selection`); only the drawn mark changes, so pair it with an
   *  `indicator` (`'check'` / `'radio'`) or `selection="multiple"` for the
   *  semantics. Composes with `renderOption`. */
  renderIndicator?: (state: OptionState<V>) => React.ReactNode
  /** `multiple` only: spell the picks out in the count summary — `3 selected:
   *  A, B, C` (labels comma-joined) in place of the bare `3 selected`. Applies
   *  to the multi-count case only: `All` stays `All`, a single pick stays its
   *  own label, and an empty selection stays the `placeholder`. The list flows
   *  into the read-only field, so it ellipsizes at the field's width when long
   *  (`3 selected: Engineering, Des… `). `renderSummary` overrides this. */
  verbose?: boolean
  /** `multiple` only: build the trigger's selection summary text yourself,
   *  replacing the built-in "`All` / one label / `N selected`" logic. Receives
   *  the resolved selected options (`selected.length` is the count) and runs only
   *  while something is selected — an empty selection still shows the
   *  `placeholder`. Return a **string**: it flows into the default trigger's
   *  read-only field, so a long summary ellipsizes at the field's width just
   *  like a long value (`Engineering, Design, … `). Return `undefined` to fall
   *  back to the default for that case (e.g. customize only the count, keeping
   *  the single-label case built-in). For rich content (chips, multiple nodes)
   *  use `renderTrigger`, which replaces the whole field. */
  renderSummary?: (selected: SelectOption<V>[]) => string | undefined
  /** Replaces the default field with a trigger returned from this function.
   *  Receives `open`, `value`, `selected`, `disabled`, and `icon`. Return exactly
   *  one focusable element, such as an Anta `Button`. The menu is positioned
   *  relative to that element and opens when it is clicked. Do not return a
   *  fragment, multiple siblings, or a non-focusable wrapper. Add
   *  `aria-haspopup="menu"` and `aria-expanded={state.open}` to the element.
   *  Field props (`label`, `hint`, `size`, `status`, `placeholder`, and `round`) and
   *  `className` / `style` apply only to the default field. Add styling and
   *  attributes to the returned element instead. */
  renderTrigger?: (state: TriggerState<V>) => React.ReactNode
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
export type SelectProps<V extends OptionValue = string> = SelectCommonProps<V> &
  (
    | {
        /** Selection mode. `'single'` (the default) keeps `value` a single value and
         *  closes the menu on pick. Switch to `'multiple'` for checkboxes + an
         *  array value.
         *  @defaultValue single */
        selection?: 'single'
        /** Controlled value: the selected option's `value`. Update it through
         *  `onValueChange`. Leave it undefined for uncontrolled use. */
        value?: V
        /** Initial selected option value for uncontrolled use. */
        defaultValue?: V
        /** Fires after the selection changes, with the new value and a
         *  `{ value, option }` snapshot. Select has no discrete element state, so
         *  there is no cancelable `onStateChange` (see the Input event-model note). */
        onValueChange?: (value: V, attrs: SelectChangeAttrs<V>) => void
      }
    | {
        /** Multi-select: checkboxes on every row, the menu stays open while
         *  toggling, the field shows an "N selected" count, and `value` is an array. */
        selection: 'multiple'
        /** Controlled values — the `value`s of the selected options (see the
         *  single-select `value` note). */
        value?: V[]
        /** Initial values (option `value`s) for the uncontrolled case. */
        defaultValue?: V[]
        /** Fires after any toggle, with the new value array and a `{ value, option,
         *  selected }` snapshot of the row that changed (or `{ all: true }` for the
         *  Select-all row). */
        onValueChange?: (value: V[], attrs: SelectChangeAttrs<V>) => void
      }
  )

/** Rolled-up selection of a group / submenu subtree: `'none'` / `'all'` of the
 *  descendant leaves selected, or `'some'` in between. On `SelectedGroup` /
 *  `SelectedSubmenu`, for a section indicator or custom styling. */
export type SelectionState = 'none' | 'some' | 'all'

/** A leaf option annotated with its current selection — a `SelectOption` plus
 *  `selected`. Returned by {@link optionsWithSelection}. */
export type SelectedOption<V extends OptionValue = string> = SelectOption<V> & { selected: boolean }

/** A group with its descendants annotated and a rolled-up `selectionState`.
 *  Returned by {@link optionsWithSelection}. */
export interface SelectedGroup<V extends OptionValue = string> extends Omit<SelectGroup<V>, 'options'> {
  options: SelectedItem<V>[]
  selectionState: SelectionState
}

/** A submenu with its descendants annotated and a rolled-up `selectionState`.
 *  Returned by {@link optionsWithSelection}. */
export interface SelectedSubmenu<V extends OptionValue = string> extends Omit<SelectSubmenu<V>, 'submenu'> {
  submenu: SelectedItem<V>[]
  selectionState: SelectionState
}

/** One node of the tree from {@link optionsWithSelection}: a leaf `SelectedOption`
 *  (with `selected`), or a `SelectedGroup` / `SelectedSubmenu` (annotated children
 *  + rolled-up `selectionState`). Mirrors `SelectItem` minus the bare-string
 *  shorthand — strings are normalized to `SelectedOption`. */
export type SelectedItem<V extends OptionValue = string> =
  | SelectedOption<V>
  | SelectedGroup<V>
  | SelectedSubmenu<V>

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
export function optionsWithSelection<V extends OptionValue = string>(
  options: SelectItem<V>[],
  values: V | V[] | undefined,
): SelectedItem<V>[] {
  const set = new Set<V>(values == null ? [] : Array.isArray(values) ? values : [values])

  const state = (on: number, total: number): SelectionState =>
    on === 0 ? 'none' : on === total ? 'all' : 'some'

  // One bottom-up pass: each node reports its (on, total) leaf tally and every
  // parent rolls up by summing its children's tallies — so a subtree is counted
  // once, not re-descended once per enclosing ancestor (the old rollUp was
  // O(n·depth)). Summing tallies matches leaf-counting exactly, including empty
  // groups (total 0 → 'none').
  type Counted = { node: SelectedItem<V>; on: number; total: number }
  const walk = (items: SelectItem<V>[]): Counted[] =>
    items.map((raw): Counted => {
      if (typeof raw !== 'string' && Array.isArray((raw as SelectSubmenu<V>).submenu)) {
        const sm = raw as SelectSubmenu<V>
        const children = walk(sm.submenu)
        const on = children.reduce((n, c) => n + c.on, 0)
        const total = children.reduce((n, c) => n + c.total, 0)
        return { node: { ...sm, submenu: children.map((c) => c.node), selectionState: state(on, total) }, on, total }
      }
      if (typeof raw !== 'string' && Array.isArray((raw as SelectGroup<V>).options)) {
        const g = raw as SelectGroup<V>
        const children = walk(g.options)
        const on = children.reduce((n, c) => n + c.on, 0)
        const total = children.reduce((n, c) => n + c.total, 0)
        return { node: { ...g, options: children.map((c) => c.node), selectionState: state(on, total) }, on, total }
      }
      const o = normalizeOpt(raw as SelectOption<V> | string)
      const selected = set.has(o.value)
      return { node: { ...o, selected }, on: selected ? 1 : 0, total: 1 }
    })

  return walk(options).map((c) => c.node)
}

/**
 * `<Select>` lets people choose one or more options from a dropdown. It uses an
 * `<Input>` as its read-only trigger and a `<Menu>` for its options. `selection` sets behavior:
 * `'single'` (default; `value` is a string, menu closes on pick) or `'multiple'`
 * (checkboxes, `value` is a string array, menu stays open while toggling, the
 * field shows an "N selected" count). For single-select, `indicator` picks the
 * per-row mark: `'none'` (tint only, default), `'check'` (trailing checkmark), or
 * `'radio'` (leading radio).
 *
 * Use `value` with `onValueChange` to control the selection, or use
 * `defaultValue` for uncontrolled use. There is no `a-select` element. See the
 * docs for the equivalent markup without React or Preact.
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
export const Select = <V extends OptionValue = string>(props: SelectProps<V>) => {
  // External API is a discriminated union (value typed by `selection`); internally
  // we treat it loosely — `multiple` branches at runtime.
  const {
    options,
    placement,
    offset,
    selection,
    indicator,
    value,
    defaultValue,
    onValueChange,
    placeholder,
    icon,
    leading,
    label,
    hint,
    size,
    status,
    statusIcon,
    round,
    disabled,
    toneSelected,
    filter,
    selectAll = true,
    selectAllLabel = 'Select all',
    clearable,
    clearLabel = 'Clear',
    renderOption,
    renderIndicator,
    verbose,
    renderSummary,
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
  const emit = onValueChange as ((value: any, attrs: SelectChangeAttrs<V>) => void) | undefined

  const controlled = value !== undefined
  // Uncontrolled selection lives here (component state re-render is allowed where
  // element DOM mutation isn't). `open` drives the chevron + aria-expanded.
  const [internal, setInternal] = useState<V | V[] | undefined>(defaultValue)
  const currentRaw = controlled ? value : internal
  const [open, setOpen] = useState(false)
  // Filter query (reset when the menu closes — see the Menu's onStateChange).
  const [query, setQuery] = useState('')
  // Combobox active-option id, reported by the menu's `activedescendant` event.
  // Select, the reactive layer that renders the filter field, reflects it onto the
  // field's `aria-activedescendant` — the element must not write that light-DOM
  // attribute itself.
  const [activeId, setActiveId] = useState<string | null>(null)
  const uid = useId()

  // Discriminate an `options` entry by shape: a `submenu` array → flyout branch, an
  // `options` array → inline group, otherwise a leaf option.
  const isSubmenu = (it: SelectItem<V>): it is SelectSubmenu<V> =>
    typeof it === 'object' && Array.isArray((it as SelectSubmenu<V>).submenu)
  const isGroup = (it: SelectItem<V>): it is SelectGroup<V> =>
    typeof it === 'object' && Array.isArray((it as SelectGroup<V>).options)

  // Flatten the tree to its leaf options once, carrying each leaf's *effective*
  // disabled (cascaded from any group/submenu ancestor) and its immediate parent's
  // label (the heading a filter query flattens it under). Everything value-shaped —
  // `byValue`, the selection count, Select-all — reads this flat list; only
  // rendering walks the tree.
  interface Leaf { opt: SelectOption<V>; disabled: boolean; group?: string }
  const collectLeaves = (items: SelectItem<V>[], group: string | undefined, disabled: boolean, out: Leaf[]) => {
    for (const raw of items) {
      if (typeof raw !== 'string' && isSubmenu(raw)) collectLeaves(raw.submenu, raw.label, disabled || !!raw.disabled, out)
      else if (typeof raw !== 'string' && isGroup(raw)) collectLeaves(raw.options, raw.label, disabled || !!raw.disabled, out)
      else {
        const o = normalizeOpt(raw)
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
  // selects/toggles together. The seen-set is keyed on the *stringified* value, so it
  // also catches two distinct values that collide once stringified (`365` and `"365"`) —
  // harmless to selection (compared with `===`) but a clash for the React key / DOM id.
  const seenValues = new Set<string>()
  for (const l of allLeaves) {
    const key = String(l.opt.value)
    if (seenValues.has(key))
      console.warn(`[anta] <Select> duplicate option value=${JSON.stringify(l.opt.value)} — values must be unique (compared as strings for row keys).`)
    seenValues.add(key)
  }
  const byValue = new Map<V, SelectOption<V>>(allLeaves.map((l) => [l.opt.value, l.opt]))

  // `filter`: which options the menu shows. The built-in matcher is a regex that's
  // case-insensitive and treats each run of whitespace in the query as "one or more
  // whitespace symbols" (so a typed space spans any gap); a function is a custom
  // per-option predicate. `queryRe` is null for a function or an empty query — which
  // is also the signal to skip match-highlighting.
  const filtering = filter !== undefined && filter !== false
  const q = query.trim()
  const queryRe = filtering && typeof filter !== 'function' ? matchQueryRegex(q) : null
  const matches = (o: SelectOption<V>) =>
    typeof filter === 'function' ? filter(o, q) : matchesQuery(o, queryRe)
  // Which leaves survive the filter. A custom filter *function* prunes on every
  // render (even with an empty query), so a predicate that filters by a criterion —
  // not the typed text — always applies. The built-in matcher only prunes once
  // something is typed (empty query = show all; a text function matches '' → all).
  const prune = typeof filter === 'function' || (filtering && !!q)
  const visibleLeaves = prune ? allLeaves.filter((l) => matches(l.opt)) : allLeaves
  // A typed query flattens the tree into grouped results; with no query we render
  // the tree (inline groups + submenu flyouts). A function filter prunes in place.
  const flattening = filtering && !!q

  // Collapse whatever selection shape we have into a lookup list. Values compare by
  // `===`, so this works for any primitive `V` without stringifying.
  const selectedValues: V[] = Array.isArray(currentRaw)
    ? currentRaw
    : currentRaw != null
      ? [currentRaw as V]
      : []
  const isSelected = (v: V) => selectedValues.includes(v)
  // Only values that map to a real option row count toward the trigger — a stale or
  // unknown value contributes nothing rather than corrupting the label or the count.
  const selectedOptions = selectedValues.map((v) => byValue.get(v)).filter(Boolean) as SelectOption<V>[]

  // "All" reads from `allLeaves`, not the filter-scoped `visibleLeaves`, so a filter
  // query can't make the trigger claim "All" over a visible subset. Gated on >1 option
  // so a lone selected option still reads as its own label.
  const allEnabledValues = allLeaves.filter((l) => !l.disabled).map((l) => l.opt.value)
  const everythingSelected =
    multiple && allEnabledValues.length > 1 && allEnabledValues.every((v) => selectedValues.includes(v))

  const labelOf = (o: SelectOption<V>) => o.label ?? String(o.value)
  let display = ''
  if (multiple) {
    // Consumer summary wins; '' / undefined falls through to the built-in text.
    const custom = selectedOptions.length > 0 ? renderSummary?.(selectedOptions) : undefined
    if (custom != null && custom !== '') display = custom
    else if (everythingSelected) display = 'All'
    else if (selectedOptions.length === 1) display = labelOf(selectedOptions[0])
    else if (selectedOptions.length > 1) {
      const count = `${selectedOptions.length} selected`
      display = verbose ? `${count}: ${selectedOptions.map(labelOf).join(', ')}` : count
    }
  } else if (currentRaw != null) {
    const o = byValue.get(currentRaw as V)
    display = o ? labelOf(o) : ''
  }

  const choose = (o: SelectOption<V>, e?: any) => {
    if (multiple) {
      // Alt/Option-click clears every other selection and selects this row. The
      // default row tooltip describes the shortcut. It is available only when
      // `selectAll` is enabled. `altKey` covers Alt and macOS Option while
      // avoiding the Ctrl-click/context-menu conflict.
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
  // Footer "Clear": empty the selection (single → undefined, multiple → []). Single
  // must clear to `undefined`, not '': `selectedValues` treats '' as a present pick,
  // which would keep the footer's Clear row visible with nothing to clear.
  const clear = () => {
    const next = multiple ? [] : undefined
    if (!controlled) setInternal(next)
    emit?.(next as V | V[], { all: true, selected: false })
  }

  // One option row. `disabled` is the leaf's *effective* disabled (cascaded).
  const renderOptionRow = (o: SelectOption<V>, disabled: boolean) => {
    const { className: optionClassName, style: optionStyle, ...optionAttrs } = optionPresentationAttrs(o, true)
    const optState: OptionState<V> = { value: o.value, selected: isSelected(o.value), disabled }
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
    const isolateHint = multiple && selectAll && !disabled ? ISOLATE_HINT : undefined
    const tip = o.tooltip ?? isolateHint
    const hintOnly = o.tooltip == null && isolateHint != null
    return (
      <MenuItem
        key={String(o.value)}
        {...optionAttrs}
        id={`${uid}-opt-${o.value}`}
        selectionIndicator={menuItemIndicator}
        {...ariaSelectable}
        indicator={customMark ?? undefined}
        label={custom ? undefined : highlight(o.label ?? String(o.value), queryRe)}
        hint={custom ? undefined : o.hint ? highlight(o.hint, queryRe) : o.hint}
        icon={custom ? undefined : o.icon}
        tone={o.tone}
        toneSelected={toneSelected}
        selected={isSelected(o.value)}
        disabled={disabled || undefined}
        data-menu-open={multiple ? '' : undefined}
        onSelect={(e: any) => choose(o, e)}
        className={optionClassName}
        style={optionStyle}
      >
        {custom}
        {tip && (
          <Tooltip follow {...(hintOnly ? { delay: 700 } : {})}>{tip}</Tooltip>
        )}
      </MenuItem>
    )
  }

  // Idle render: walk the tree. Groups render inline (`MenuGroup`), submenus as
  // flyouts (`MenuItem submenu` + nested `Menu`). A function filter prunes leaves in
  // place; a container with no surviving descendant is dropped so no empty flyout
  // or heading shows.
  const renderTree = (items: SelectItem<V>[], disabled: boolean): React.ReactNode[] => {
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
      const o = normalizeOpt(raw)
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
        leading={leading ?? (icon ? <Icon shape={icon} /> : undefined)}
        size={size}
        status={status}
        statusIcon={statusIcon}
        round={round}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        // <a-menu> handles Enter, Space, and ArrowDown on this read-only field by
        // binding keydown on its trigger anchor, so there is no
        // onKeyDown here synthesizing a click on the live node.
        trailing={
          // The named tag applies the Select-specific rotation while the icon remains
          // a normal currentColor glyph.
          <a-select-chevron open={open ? '' : undefined} style={statusColor ? { color: statusColor } : undefined}>
            <Icon shape="chevron-down" />
          </a-select-chevron>
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
        placement={placement}
        offset={offset}
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
          <a-select-header slot="header" data-menu-open="">
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
          </a-select-header>
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
        {clearable && selectedValues.length > 0 && (
          // Pinned in the footer so it never scrolls away in a long / filtered list.
          <>
            <MenuSeparator slot="footer" />
            <a-select-footer slot="footer">
              <MenuItem icon="x" label={clearLabel} data-menu-open="" onSelect={clear} />
            </a-select-footer>
          </>
        )}
      </Menu>
    </>
  )
}
