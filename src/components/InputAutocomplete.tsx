// InputAutocomplete — a free-text field with a suggestion list. The value is the
// typed string; suggestions only assist and needn't be taken. This is the whole
// reason it's separate from `Select`: a value CONSTRAINED to an option is
// `Select` with `filter` (search); this is for free text with hints.
//
// Composed from `Input` (the always-visible anchor) + `Menu` (the suggestions),
// reusing a-menu's combobox mode: `data-menu-search` on the anchor engages the
// combobox keyboard (typed query → off-DOM active cursor, arrow-nav, Enter picks
// the highlight). There is no `a-input-autocomplete` element — this wrapper is
// the coordinator.
//
// Hooks come from the jsx-runtime indirection (configurable via `configure()`),
// not a hard `react` import — same rule as `Select` / `RadioGroup`.
import { useState, useMemo, useId } from '../jsx-runtime'
import { nativeStateChange, matchQueryRegex } from '../anta_helpers'
import type { BaseProps } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import type { SelectOption } from './Select'
import { Input } from './Input'
import { Menu } from './Menu'
import { MenuItem } from './MenuItem'

const normalizeOpt = (o: string | SelectOption): SelectOption =>
  typeof o === 'string' ? { value: o, label: o } : o

export interface InputAutocompleteProps extends Omit<BaseProps, 'children'> {
  /** The suggestions: bare strings or `SelectOption`s (`value` / `label` / `hint` /
   *  `icon` / `tone` / `disabled`). A flat list; picking one fills the field. */
  suggestions: (string | SelectOption)[]
  /** Controlled value: the field's text, a **free** string not constrained to a
   *  suggestion. Leave undefined for uncontrolled. */
  value?: string
  /** Initial value for the uncontrolled case (the wrapper then owns it). */
  defaultValue?: string
  /** Fires as the text changes (typing, picking a suggestion, or clearing) with
   *  the new field text. */
  onValueChange?: (value: string) => void
  /** Fires only when a suggestion is chosen, with that option. */
  onSelect?: (option: SelectOption) => void
  /** How suggestions match the text. `true` uses the built-in case-insensitive
   *  substring match on `value` / `label` / `hint`; a function `(option, query) =>
   *  boolean` does custom matching; `false` shows `suggestions` verbatim so you
   *  can filter them yourself (async / remote).
   *  @defaultValue true */
  filter?: boolean | ((option: SelectOption, query: string) => boolean)
  /** Placeholder text. */
  placeholder?: string
  /** Field size.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Validation status. */
  status?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
  /** Status icon override, or `false` to drop it. */
  statusIcon?: IconShape | (string & {}) | false
  /** Custom accent colour — a named tone or any CSS colour. */
  tone?: string
  /** Show a clear button while the field has text. */
  clearable?: boolean
  /** Form field name. */
  name?: string
  /** Disable the field. */
  disabled?: boolean
  /** Field label. */
  label?: React.ReactNode
  /** Hint under the field. */
  hint?: React.ReactNode
  /** Leading adornment inside the field. */
  leading?: React.ReactNode
  /** Trailing adornment inside the field. */
  trailing?: React.ReactNode
}

/**
 * `<InputAutocomplete>` — a text field whose value is a free string, with a
 * suggestion dropdown that assists without constraining. Typing something not in
 * the list is valid and stays the value; picking a suggestion just fills the
 * field. For a value that MUST be one of the options, use `Select` with `filter`.
 *
 * Controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`).
 * Requires `@antadesign/anta/elements` (client-side only).
 *
 * @example
 * ```tsx
 * <InputAutocomplete
 *   label="City"
 *   suggestions={['Berlin', 'Bogotá', 'Boston']}
 *   value={city}
 *   onValueChange={setCity}
 * />
 * ```
 */
export const InputAutocomplete = (props: InputAutocompleteProps) => {
  const {
    suggestions,
    value,
    defaultValue,
    onValueChange,
    onSelect,
    filter = true,
    ...rest
  } = props

  const rid = useId()
  const controlled = value !== undefined
  // Uncontrolled text lives here (component state re-render is allowed where
  // element DOM mutation isn't).
  const [internal, setInternal] = useState<string>(defaultValue ?? '')
  const text = controlled ? value : internal
  // `open` is the intent; `menuOpen` also requires something to show, so an empty
  // (no-match) query never floats a blank popover. The Menu is controlled by it.
  const [open, setOpen] = useState(false)
  // Combobox cursor id, reported by the menu's `activedescendant` event and
  // reflected onto the field's `aria-activedescendant` (the element must not
  // write that light-DOM attribute itself).
  const [activeId, setActiveId] = useState<string | null>(null)

  const options = useMemo(() => suggestions.map(normalizeOpt), [suggestions])
  // Matching mirrors Select's search: a custom function prunes on every render;
  // the built-in matcher (shared `matchQueryRegex`) prunes only once something is
  // typed (empty query = show all). `queryRe` is null for a function / empty query
  // — which is also the signal to skip match-highlighting.
  const custom = typeof filter === 'function'
  const queryRe = filter !== false && !custom ? matchQueryRegex(text) : null
  const visible = custom
    ? options.filter((o) => (filter as (o: SelectOption, q: string) => boolean)(o, text))
    : queryRe
      ? options.filter((o) => [o.value, o.label ?? '', o.hint ?? ''].some((s) => queryRe.test(s)))
      : options
  const menuOpen = open && visible.length > 0

  // Bold the matched substring(s) for display — built-in matcher only, same as
  // Select. `queryRe` is global-flagged fresh so exec walks every match.
  const highlight = (t: string): React.ReactNode => {
    if (!queryRe) return t
    const re = new RegExp(queryRe.source, 'gi')
    const out: React.ReactNode[] = []
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(t)) !== null) {
      if (m.index > last) out.push(t.slice(last, m.index))
      out.push(<b key={out.length}>{m[0]}</b>)
      last = m.index + m[0].length
      if (m[0].length === 0) re.lastIndex++ // guard against a zero-width match looping
    }
    if (out.length === 0) return t
    if (last < t.length) out.push(t.slice(last))
    return out
  }

  const setText = (next: string) => {
    if (!controlled) setInternal(next)
    onValueChange?.(next)
  }

  const pick = (opt: SelectOption) => {
    setText(opt.value)
    onSelect?.(opt)
    setOpen(false)
  }

  return (
    <>
      <Input
        {...rest}
        value={text}
        // `data-menu-search` makes the menu treat THIS anchor as its combobox
        // field (see a-menu's #comboAnchor). ARIA mirrors Select's pattern — the
        // element never writes aria-activedescendant itself; we reflect the id.
        data-menu-search=""
        aria-haspopup="listbox"
        aria-expanded={menuOpen ? 'true' : 'false'}
        aria-autocomplete="list"
        aria-activedescendant={menuOpen && activeId ? activeId : undefined}
        onFocus={() => setOpen(true)}
        onInput={(e: any) => {
          setText(e.currentTarget.value)
          setOpen(true)
        }}
        onKeyDown={(e: any) => {
          // Enter with a highlighted suggestion is handled by a-menu's combobox
          // keyboard (capture phase) → picks it. With no highlight, Enter just
          // confirms the typed free text and closes the list.
          if (e.key === 'Enter' && !activeId) setOpen(false)
        }}
      />
      {/* Anchors to the field (its previous sibling). Controlled by `menuOpen`;
          user dismiss (Esc / outside-click) fires onStateChange, which we apply.
          `autoWidth` is omitted so the list floors to the field width. */}
      <Menu
        open={menuOpen}
        onStateChange={(_e: any, { next }: { next: boolean }) => {
          setOpen(next)
          if (!next) setActiveId(null)
        }}
        onactivedescendant={(e: any) => setActiveId(nativeStateChange<{ id: string | null }>(e).detail?.id ?? null)}
      >
        {visible.map((opt, i) => (
          <MenuItem
            key={`${rid}-${opt.value}-${i}`}
            id={`${rid}-o${i}`}
            icon={opt.icon}
            label={queryRe ? highlight(opt.label ?? opt.value) : opt.label ?? opt.value}
            hint={queryRe && opt.hint ? highlight(opt.hint) : opt.hint}
            tone={opt.tone}
            disabled={opt.disabled}
            value={opt.value}
            onSelect={() => pick(opt)}
          />
        ))}
      </Menu>
    </>
  )
}
