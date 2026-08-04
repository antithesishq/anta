// SelectFaceted renders a trigger Button followed by a Menu. The menu has one
// category, or facet, per row. Each facet opens an editor for a single, multiple,
// text, or custom value. The value record uses a facet key, so the same option
// value can appear in separate application categories without colliding.
//
// Hooks come from the jsx-runtime indirection (configurable via `configure()`),
// not a hard `react` import — same rule as `Select` / `RadioGroup`.
import { useState, useMemo } from '../jsx-runtime'
import { nativeStateChange, ISOLATE_HINT } from '../anta_helpers'
import type { BaseProps } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import type { OptionValue, SelectItem, SelectOption } from './Select'
import { normalizeOpt, matchQueryRegex, matchesQuery } from './select-options'
import { Button } from './Button'
import { Menu, type MenuProps } from './Menu'
import { MenuItem } from './MenuItem'
import { MenuGroup } from './MenuGroup'
import { MenuSeparator } from './MenuSeparator'
import { Tag } from './Tag'
import { Input } from './Input'
import { Tooltip } from './Tooltip'
import './select-parts.css'

// ---- Facet config -------------------------------------------------------

interface FacetBase {
  /** The key for this facet's value in the record. `onValueChange` reports it as
   *  `attrs.facet`. It must be unique across `facets`. */
  key: string
  /** The facet's row label in the menu. */
  label: string
  /** Leading icon on the facet's row. */
  icon?: IconShape
}

/** A per-facet option-list filter (like `Select`'s `filter`): `true` uses the
 *  built-in case-insensitive substring match on an option's value / label /
 *  hint; a function `(option, query) => boolean` does custom matching. */
export type FacetFilter = boolean | ((option: SelectOption<OptionValue>, query: string) => boolean)

/** Pick **one** option. Value: the chosen option's `value` (or `undefined` when
 *  cleared). Re-picking the selected option clears it. Options are `Select`'s
 *  `SelectItem`s — bare strings or `SelectOption`s carrying the same fields
 *  (`value`, `label`, `hint`, `icon`, `tone`, `disabled`). Option `value`s may be
 *  `string` / `number` / `boolean` and round-trip unchanged. */
export interface SelectFacetSingle extends FacetBase {
  kind: 'single'
  /** The options — bare strings or `SelectOption`s (groups / submenus are
   *  flattened to their leaves). */
  options: SelectItem<OptionValue>[]
  /** Add a search field atop this facet's flyout that filters its options. */
  filter?: FacetFilter
}

/** Pick **any number** of options. Value: an array of the chosen `value`s
 *  (empty array clears the facet). Options are the same `SelectItem`s as `single`,
 *  with the same `string` / `number` / `boolean` value support. */
export interface SelectFacetMultiple extends FacetBase {
  kind: 'multiple'
  /** The options — bare strings or `SelectOption`s (groups / submenus flattened). */
  options: SelectItem<OptionValue>[]
  /** Add a search field atop this facet's flyout that filters its options. */
  filter?: FacetFilter
  /** A "Select all" row that toggles every option. On by default — set `false`
   *  to drop it.
   *  @defaultValue true */
  selectAll?: boolean
  /** Label for the `selectAll` row.
   *  @defaultValue Select all */
  selectAllLabel?: string
}

/** Free-form substring. Value: the typed string (or `undefined` when empty).
 *  Applies on Enter or blur — not on every keystroke. */
export interface SelectFacetText extends FacetBase {
  kind: 'text'
  /** Placeholder for the text field. */
  placeholder?: string
}

/** Context handed to a `custom` facet's `render`. */
export interface SelectFacetCustomContext<V> {
  /** The facet's current value (`undefined` when unset). */
  value: V | undefined
  /** Apply a new value for this facet — pass `undefined` to clear it. */
  onChange: (next: V | undefined) => void
  /** Close the whole filter menu (e.g. after applying from a custom editor). */
  close: () => void
}

/** A custom editor and value type for values the built-in kinds do not cover,
 *  including objects such as date ranges and numeric comparisons. */
export interface SelectFacetCustom<V = unknown> extends FacetBase {
  kind: 'custom'
  /** Render the facet's editor inside its flyout. The returned node stays
   *  mounted while the menu is open. */
  render: (ctx: SelectFacetCustomContext<V>) => React.ReactNode
  /** Reduce an active value to a short summary shown on the facet's row (a
   *  string or any node). Called only when the value is set. */
  summary: (value: V) => React.ReactNode
}

/** One filter category, discriminated by `kind`. */
export type SelectFacet =
  | SelectFacetSingle
  | SelectFacetMultiple
  | SelectFacetText
  | SelectFacetCustom

/** The filter value: a facet key → that facet's value. Per kind: an option value
 *  (`string` / `number` / `boolean`) for `single`, a `string` for `text`, an array for
 *  `multiple`, or a `V` value for `custom`. Values are stored and reported unchanged.
 *  Typed loosely as `unknown` since facets in one control can hold different value
 *  types; narrow per facet when you read it. A cleared facet is absent from the record. */
export type SelectFacetedValue = Record<string, unknown>

/** Second argument to `onValueChange` — what changed. A single-facet edit
 *  carries `facet` / `kind` / the facet's new `value`; the "Clear all" row
 *  carries `all: true`. Narrow on `'all' in attrs`. */
export type SelectFacetedChangeAttrs =
  | {
      /** The facet key that changed. */
      facet: string
      /** That facet's kind. */
      kind: SelectFacet['kind']
      /** The facet's new value (`undefined` when the facet was cleared). */
      value: unknown
    }
  | {
      /** Marks the change as the "Clear all" row emptying every facet. */
      all: true
    }

/** Snapshot passed to `renderTrigger` so a custom trigger can reflect the
 *  current filter and open state. */
export interface SelectFacetedTriggerState {
  /** Whether the menu is open — use it for `aria-expanded` and a chevron. */
  open: boolean
  /** The whole current value record. */
  value: SelectFacetedValue
  /** Number of **active facets** (each facet with a value counts once,
   *  regardless of how many options it holds) — the default badge count. */
  count: number
  /** Whether the whole control is disabled. */
  disabled: boolean
}

export interface SelectFacetedProps extends Omit<BaseProps, 'children'> {
  /** Categories to filter by. Each facet has a `kind` that determines its editor. */
  facets: SelectFacet[]
  /** Preferred placement of the root filter menu relative to its trigger. The
   *  menu auto-flips vertically and clamps horizontally when needed.
   *  @defaultValue bottom-start */
  placement?: MenuProps['placement']
  /** Gap in pixels between the trigger and the filter menu.
   *  @defaultValue 4 */
  offset?: number
  /** Controlled value record, keyed by facet. When provided, update it through
   *  `onValueChange`. Leave it undefined for uncontrolled use. */
  value?: SelectFacetedValue
  /** Initial value for uncontrolled use. */
  defaultValue?: SelectFacetedValue
  /** Fires after any facet changes. `value` is the whole new record (a facet key →
   *  that facet's value; a cleared facet is absent). `attrs` says what changed:
   *  `{ facet, kind, value }` for a single facet edit, or `{ all: true }` for the
   *  "Clear all" row — narrow on `'all' in attrs` before reading `facet`. */
  onValueChange?: (value: SelectFacetedValue, attrs: SelectFacetedChangeAttrs) => void
  /** Default trigger's button label.
   *  @defaultValue Filter */
  label?: string
  /** Default trigger's leading icon.
   *  @defaultValue filter */
  icon?: IconShape
  /** Default trigger's button size.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Default trigger's button priority.
   *  @defaultValue secondary */
  priority?: 'primary' | 'secondary'
  /** Disable the whole control. */
  disabled?: boolean
  /** Tone applied to a selected option row in the facet flyouts (label, selected
   *  tint, and the check / checkbox indicator). A named tone or a custom CSS
   *  colour, matching `Select`'s `toneSelected`. Defaults to a neutral selection. */
  toneSelected?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Adds a search field at the top of the root menu. It searches the options of
   *  every `single` and `multiple` facet in one list. For example, "alice" can
   *  appear under application-defined Assignee and Owner facets. `text` and
   *  `custom` facets remain available when the search is empty. Each facet uses
   *  its `filter` function when supplied, or the built-in substring match. */
  searchable?: boolean
  /** Placeholder for the global search field.
   *  @defaultValue Filter… */
  searchPlaceholder?: string
  /** Show the per-facet "Clear" row and the "Clear all" row.
   *  @defaultValue true */
  clearable?: boolean
  /** Label for the "Clear all" row.
   *  @defaultValue Clear all */
  clearAllLabel?: string
  /** Replaces the default `Button` with a trigger returned from this function.
   *  Receives a `SelectFacetedTriggerState`. Return exactly one focusable element:
   *  the menu is positioned relative to that element and opens when it is clicked.
   *  Add `aria-haspopup="menu"` and `aria-expanded={state.open}` to the returned
   *  element. `className`, `style`, and other trigger props apply only to the
   *  default Button, so add styling and attributes to the returned element. */
  renderTrigger?: (state: SelectFacetedTriggerState) => React.ReactNode
}

// ---- Helpers ------------------------------------------------------------

/** Flatten a facet's `options` (strings, options, groups, submenus) to leaf
 *  `SelectOption`s — v1 renders a facet's choices as a flat list. */
const leavesOf = (items: SelectItem<OptionValue>[]): SelectOption<OptionValue>[] => {
  const out: SelectOption<OptionValue>[] = []
  for (const it of items) {
    if (typeof it !== 'string' && Array.isArray((it as { submenu?: unknown }).submenu))
      out.push(...leavesOf((it as { submenu: SelectItem<OptionValue>[] }).submenu))
    else if (typeof it !== 'string' && Array.isArray((it as { options?: unknown }).options))
      out.push(...leavesOf((it as { options: SelectItem<OptionValue>[] }).options))
    else out.push(normalizeOpt(it as SelectOption<OptionValue> | string))
  }
  return out
}

/** A facet value counts as unset when it's null/undefined, an empty string, or
 *  an empty array. Such facets are absent from the value record and the count. */
const isEmpty = (v: unknown): boolean =>
  v == null || v === '' || (Array.isArray(v) && v.length === 0)

/** The built-in `(option, query) => boolean` matcher, over the shared
 *  `matchQueryRegex` + `matchesQuery`. Builds the regex per call — cheap, and it
 *  keeps the per-option predicate signature the facet filters expect. */
const defaultMatch = (o: SelectOption<OptionValue>, query: string): boolean =>
  matchesQuery(o, matchQueryRegex(query))

/**
 * `<SelectFaceted>` filters a result set by categories called facets. Its
 * trigger opens a facet menu, and each facet opens a control for its value.
 * The available kinds are `'single'`, `'multiple'`, `'text'`, and `'custom'`.
 * The value is a `Record<facetKey, value>`, so values under different facet
 * keys stay distinct.
 *
 * Controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`).
 * There is no `a-select-faceted` element — this wrapper is the coordinator.
 *
 * Requires `@antadesign/anta/elements` (client-side only).
 *
 * @example
 * ```tsx
 * <SelectFaceted
 *   facets={[
 *     { key: 'assignee', label: 'Assignee', kind: 'multiple', options: people },
 *     { key: 'owner',    label: 'Owner',    kind: 'single',   options: people },
 *     { key: 'title',    label: 'Title',    kind: 'text' },
 *   ]}
 *   value={filters}
 *   onValueChange={setFilters}
 * />
 * ```
 */
export const SelectFaceted = (props: SelectFacetedProps) => {
  const {
    facets,
    placement,
    offset,
    value,
    defaultValue,
    onValueChange,
    label = 'Filter',
    icon = 'filter',
    size,
    priority = 'secondary',
    disabled,
    toneSelected,
    searchable,
    searchPlaceholder = 'Filter…',
    clearable = true,
    clearAllLabel = 'Clear all',
    renderTrigger,
    className,
    style,
    ...rest
  } = props

  const controlled = value !== undefined
  // Uncontrolled selection lives here (component state re-render is allowed
  // where element DOM mutation isn't).
  const [internal, setInternal] = useState<SelectFacetedValue>(defaultValue ?? {})
  const current = controlled ? value : internal
  // The root menu is controlled so a `custom` facet's `close()` can dismiss it;
  // submenus stay uncontrolled regardless.
  const [open, setOpen] = useState(false)
  // Text-facet drafts — the value only commits to `current` on Enter / blur.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  // Re-seed a text draft when its committed value changes from OUTSIDE this editor
  // (cleared elsewhere, controlled update). Adjust-state-during-render, guarded per key
  // by the last value seen — so active typing (draft diverged, value unchanged) is
  // never clobbered, but an external change flows into the field.
  const [seenText, setSeenText] = useState<Record<string, unknown>>({})
  {
    let nextSeen: Record<string, unknown> | null = null
    let nextDrafts = drafts
    for (const f of facets) {
      if (f.kind !== 'text') continue
      if (seenText[f.key] !== current[f.key]) {
        nextSeen = { ...(nextSeen ?? seenText), [f.key]: current[f.key] }
        nextDrafts = { ...nextDrafts, [f.key]: (current[f.key] as string) ?? '' }
      }
    }
    if (nextSeen) {
      setSeenText(nextSeen)
      setDrafts(nextDrafts)
    }
  }
  // Per-facet option-filter queries (for facets with `filter`).
  const [queries, setQueries] = useState<Record<string, string>>({})
  // The global search query (for `searchable`) — resets when the menu closes.
  const [rootQuery, setRootQuery] = useState('')
  // Combobox active-option ids, reported by each menu's `activedescendant` event and
  // reflected onto the owning filter field's `aria-activedescendant` (the element must
  // not write that light-DOM attribute itself). Keyed by field: `__root__` for the
  // global search, the facet key for a per-facet filter.
  const [activeIds, setActiveIds] = useState<Record<string, string | null>>({})
  const onActive = (key: string) => (e: any) => {
    const id = nativeStateChange<{ id: string | null }>(e).detail?.id ?? null
    setActiveIds((s) => (s[key] === id ? s : { ...s, [key]: id }))
  }

  const activeCount = facets.reduce((n, f) => n + (isEmpty(current[f.key]) ? 0 : 1), 0)

  // Flatten each options facet's leaves once per `facets` change — visibleLeavesOf,
  // renderFlatResults, and summaryOf all read this instead of re-running the recursive
  // leavesOf() on every render / global-search keystroke.
  const leavesByKey = useMemo(
    () =>
      new Map<string, SelectOption<OptionValue>[]>(
        facets.map((f) => [
          f.key,
          f.kind === 'single' || f.kind === 'multiple' ? leavesOf(f.options) : [],
        ]),
      ),
    [facets],
  )

  const commit = (next: SelectFacetedValue, attrs: SelectFacetedChangeAttrs) => {
    if (!controlled) setInternal(next)
    onValueChange?.(next, attrs)
  }

  const setFacet = (facet: SelectFacet, nextValue: unknown) => {
    const cleared = isEmpty(nextValue)
    const next = { ...current }
    if (cleared) delete next[facet.key]
    else next[facet.key] = nextValue
    commit(next, { facet: facet.key, kind: facet.kind, value: cleared ? undefined : nextValue })
  }

  const clearAll = () => commit({}, { all: true })

  // ---- Per-kind editors -------------------------------------------------

  // Leaves of an options facet, narrowed by its filter query when `filter` is on.
  const visibleLeavesOf = (facet: SelectFacetSingle | SelectFacetMultiple): SelectOption<OptionValue>[] => {
    const leaves = leavesByKey.get(facet.key) ?? []
    if (!facet.filter) return leaves
    const q = queries[facet.key] ?? ''
    const match = typeof facet.filter === 'function' ? facet.filter : defaultMatch
    return leaves.filter((o) => match(o, q))
  }

  // A `slot="header"` filter field for an options facet (only when `filter` is set).
  // Pinned above the scrolling options, like Select's filter.
  const filterHeader = (facet: SelectFacetSingle | SelectFacetMultiple) =>
    facet.filter ? (
      <a-select-header slot="header" data-menu-open="">
        <Input
          // `data-menu-search` puts this flyout in combobox mode: a typed query
          // pseudo-focuses the first match (arrow-nav, Enter selects), same as Select.
          data-menu-search=""
          size="small"
          value={queries[facet.key] ?? ''}
          placeholder="Filter…"
          aria-label={`Filter ${facet.label}`}
          aria-autocomplete="list"
          aria-activedescendant={activeIds[facet.key] ?? undefined}
          onInput={(e: any) => setQueries((s) => ({ ...s, [facet.key]: e.currentTarget.value }))}
        />
      </a-select-header>
    ) : null

  // One option row — the same whether it renders in a facet's flyout or in the
  // flattened global-search results. Single uses a trailing check (re-pick clears);
  // multiple uses a checkbox (toggles). `keyPrefix` namespaces the React key so the
  // same option value under two facets stays a distinct row in the flat list.
  const optionRow = (facet: SelectFacetSingle | SelectFacetMultiple, opt: SelectOption<OptionValue>, keyPrefix = '') => {
    const shared = {
      icon: opt.icon,
      label: opt.label ?? String(opt.value),
      hint: opt.hint,
      tone: opt.tone,
      toneSelected,
      disabled: opt.disabled,
      'data-menu-open': '',
    }
    if (facet.kind === 'single') {
      const cur = current[facet.key] as OptionValue | undefined
      return (
        <MenuItem
          key={`${keyPrefix}${opt.value}`}
          {...shared}
          selectionIndicator="check"
          selected={cur === opt.value}
          onSelect={() => setFacet(facet, cur === opt.value ? undefined : opt.value)}
        />
      )
    }
    const arr = (current[facet.key] as OptionValue[] | undefined) ?? []
    // Alt/Option-click clears every other value and selects this row. The shortcut
    // is available when this facet shows its "Select all" row. An option tooltip
    // replaces the standard hint, and `''` hides it.
    const isolable = facet.selectAll !== false && !opt.disabled
    const tip = opt.tooltip ?? (isolable ? ISOLATE_HINT : undefined)
    const hintOnly = opt.tooltip == null && isolable
    return (
      <MenuItem
        key={`${keyPrefix}${opt.value}`}
        {...shared}
        selectionIndicator="checkbox"
        selected={arr.includes(opt.value)}
        onSelect={(e: any) =>
          isolable && e?.altKey
            ? setFacet(facet, [opt.value])
            : setFacet(facet, arr.includes(opt.value) ? arr.filter((v) => v !== opt.value) : [...arr, opt.value])
        }
      >
        {tip && <Tooltip follow {...(hintOnly ? { delay: 700 } : {})}>{tip}</Tooltip>}
      </MenuItem>
    )
  }

  const renderSingle = (facet: SelectFacetSingle) => visibleLeavesOf(facet).map((opt) => optionRow(facet, opt))

  const renderMultiple = (facet: SelectFacetMultiple) => {
    const arr = (current[facet.key] as OptionValue[] | undefined) ?? []
    const leaves = visibleLeavesOf(facet)
    // "Select all" acts on the *visible* (filtered) enabled options, like Select.
    const enabled = leaves.filter((o) => !o.disabled).map((o) => o.value)
    const allOn = enabled.length > 0 && enabled.every((v) => arr.includes(v))
    const someOn = enabled.some((v) => arr.includes(v))
    return (
      <>
        {facet.selectAll !== false && leaves.length > 0 && (
          <>
            <MenuItem
              selectionIndicator="checkbox"
              selected={allOn}
              indeterminate={someOn && !allOn}
              label={facet.selectAllLabel ?? 'Select all'}
              data-menu-open=""
              onSelect={() =>
                setFacet(
                  facet,
                  // Toggle only the visible set, preserving picks hidden by the filter.
                  allOn ? arr.filter((v) => !enabled.includes(v)) : [...new Set([...arr, ...enabled])],
                )
              }
            />
            <MenuSeparator />
          </>
        )}
        {leaves.map((opt) => optionRow(facet, opt))}
      </>
    )
  }

  // Global search creates one grouped list from every option-list facet. Each
  // matching facet becomes a MenuGroup. The same option can appear in several
  // facets. A facet uses its `filter` function when provided, otherwise the
  // built-in substring match.
  const renderFlatResults = () => {
    const groups = facets
      .filter((f): f is SelectFacetSingle | SelectFacetMultiple => f.kind === 'single' || f.kind === 'multiple')
      .map((facet) => {
        const match = typeof facet.filter === 'function' ? facet.filter : defaultMatch
        return { facet, matched: (leavesByKey.get(facet.key) ?? []).filter((o) => match(o, rootQuery)) }
      })
      .filter((g) => g.matched.length > 0)
    return groups.map(({ facet, matched }) => (
      <MenuGroup key={facet.key} label={facet.label}>
        {matched.map((opt) => optionRow(facet, opt, `${facet.key}:`))}
      </MenuGroup>
    ))
  }

  const renderText = (facet: SelectFacetText) => {
    const applied = (current[facet.key] as string | undefined) ?? ''
    const draft = drafts[facet.key] ?? applied
    // Store the draft verbatim (a trailing space and all — trimming is the consumer's
    // at match time); an all-blank draft clears. The diff-check skips a no-edit blur.
    const apply = () => {
      const next = draft.trim() === '' ? undefined : draft
      if (next !== (applied || undefined)) setFacet(facet, next)
    }
    return (
      // `data-menu-open` keeps the menu open through typing; the value commits on
      // Enter / blur, not per keystroke.
      <div data-menu-open="" style={{ padding: '4px' }}>
        <Input
          size="small"
          value={draft}
          placeholder={facet.placeholder}
          aria-label={facet.label}
          onInput={(e: any) => setDrafts((d) => ({ ...d, [facet.key]: e.currentTarget.value }))}
          onKeyDown={(e: any) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              apply()
            }
          }}
          onBlur={apply}
        />
      </div>
    )
  }

  const renderCustom = (facet: SelectFacetCustom) => (
    <div data-menu-open="">
      {facet.render({
        value: current[facet.key],
        onChange: (next) => setFacet(facet, next),
        close: () => setOpen(false),
      })}
    </div>
  )

  const renderEditor = (facet: SelectFacet) => {
    const isOptions = facet.kind === 'single' || facet.kind === 'multiple'
    const body =
      facet.kind === 'single'
        ? renderSingle(facet)
        : facet.kind === 'multiple'
          ? renderMultiple(facet)
          : facet.kind === 'text'
            ? renderText(facet)
            : renderCustom(facet)
    const hasValue = !isEmpty(current[facet.key])
    return (
      <Menu onactivedescendant={isOptions && facet.filter ? onActive(facet.key) : undefined}>
        {isOptions && filterHeader(facet)}
        {body}
        {/* Clear rides the pinned `footer` slot, so it never scrolls away in a
            long (or filtered) option list. */}
        {clearable && hasValue && (
          <>
            <MenuSeparator slot="footer" />
            <a-select-footer slot="footer">
              <MenuItem
                icon="x"
                label="Clear"
                data-menu-open=""
                onSelect={() => setFacet(facet, undefined)}
              />
            </a-select-footer>
          </>
        )}
      </Menu>
    )
  }

  // Short summary shown as a Tag on the facet's row when it has a value.
  const summaryOf = (facet: SelectFacet): React.ReactNode => {
    const v = current[facet.key]
    if (isEmpty(v)) return null
    switch (facet.kind) {
      case 'single': {
        const opt = (leavesByKey.get(facet.key) ?? []).find((o) => o.value === v)
        return opt?.label ?? String(v)
      }
      case 'multiple':
        return String((v as OptionValue[]).length)
      case 'text':
        return String(v)
      case 'custom':
        return facet.summary(v as never)
    }
  }

  const triggerState: SelectFacetedTriggerState = {
    open,
    value: current,
    count: activeCount,
    disabled: !!disabled,
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(triggerState)
      ) : (
        <Button
          icon={icon}
          label={label}
          priority={priority}
          size={size}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open ? 'true' : 'false'}
          className={className}
          style={style}
          {...rest}
        >
          {activeCount > 0 && (
            <Tag size="small" priority="primary" tone="brand">
              {String(activeCount)}
            </Tag>
          )}
        </Button>
      )}
      {/* Anchors to the trigger (its previous sibling); opens on click. Controlled
          so `custom` facets can `close()` it; user dismiss (Esc / outside-click)
          fires onStateChange, which we apply — and clears the global search. */}
      <Menu
        placement={placement}
        offset={offset}
        open={open}
        onStateChange={(_e, { next }) => {
          setOpen(next)
          if (!next) setRootQuery('')
        }}
        onactivedescendant={searchable ? onActive('__root__') : undefined}
      >
        {searchable && (
          // Pinned global search: flattens all options facets while a query is active.
          <a-select-header slot="header" data-menu-open="">
            <Input
              // Combobox mode: a typed query pseudo-focuses the first flattened match
              // (arrow-nav, Enter selects), same as Select's filter.
              data-menu-search=""
              size="small"
              value={rootQuery}
              placeholder={searchPlaceholder}
              aria-label="Filter all facets"
              aria-autocomplete="list"
              aria-activedescendant={activeIds['__root__'] ?? undefined}
              onInput={(e: any) => setRootQuery(e.currentTarget.value)}
            />
          </a-select-header>
        )}
        {searchable && rootQuery.trim()
          ? renderFlatResults()
          : facets.map((facet) => (
              <MenuItem key={facet.key} submenu icon={facet.icon} label={facet.label}>
                {(() => {
                  const s = summaryOf(facet)
                  return s != null ? (
                    <Tag size="small" tone="brand">
                      {/* Capped + ellipsized so a long summary can't stretch the menu. */}
                      <a-select-faceted-summary>{s}</a-select-faceted-summary>
                    </Tag>
                  ) : null
                })()}
                {renderEditor(facet)}
              </MenuItem>
            ))}
        {clearable && (
          <>
            <MenuSeparator slot="footer" />
            <a-select-footer slot="footer">
              <MenuItem
                icon="filter-x"
                label={clearAllLabel}
                disabled={activeCount === 0}
                data-menu-open=""
                onSelect={clearAll}
              />
            </a-select-footer>
          </>
        )}
      </Menu>
    </>
  )
}
