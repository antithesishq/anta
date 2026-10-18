import { useState, useMemo } from '../jsx-runtime'
import { isComposingKey, optionPresentationAttrs } from '../anta_helpers'
import type { BaseProps, DOMEventHandlers } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import type { SelectOption } from './Select'
import { normalizeOpt, matchQueryRegex, matchesQuery, highlight } from './select-options'
import { Input } from './Input'
import { Menu } from './Menu'
import { MenuItem } from './MenuItem'

export interface InputAutocompleteProps extends Omit<BaseProps, 'children'>, Omit<DOMEventHandlers, 'onSelect'> {
  /** The suggestions: bare strings or `SelectOption`s (`value` / `label` / `hint` /
   *  `icon` / `tone` / `disabled`). A flat list; picking one fills the field. */
  suggestions: (string | SelectOption)[]
  /** The controlled field text. Any string is valid, including `''` for an empty
   * field. Omit or pass `undefined` for uncontrolled use. Parent updates do not
   * call `onValueChange`. */
  value?: string
  /** Initial uncontrolled text and the value restored by a form reset. */
  defaultValue?: string
  /** Reports text changes from typing, picking a suggestion, clearing, or form
   * reset. */
  onValueChange?: (value: string) => void
  /** Fires after `onValueChange` when a suggestion is chosen, with the normalized
   * option. This reports the choice even if a controlled parent rejects the value.
   * Typing and clearing do not call it. */
  onSelect?: (option: SelectOption) => void
  /** How suggestions match the text. `true` uses the built-in case-insensitive
   *  substring match on `value` / `label` / `hint`; a function `(option, query) =>
   *  boolean` receives the original field text, including whitespace, once per
   *  option on each render, including when empty. Custom matching has no automatic
   *  highlighting. `false` shows `suggestions` unchanged for application-provided
   *  async or remote filtering, without automatic highlighting. Replacing results
   *  updates an open list but does not reopen a dismissed list.
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
  /** Custom accent color — a named tone or any CSS color. */
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
  /** Observe focus before the suggestion list opens. */
  onFocus?: (event: any) => void
  /** Observe focus loss. The suggestion list closes without changing the text. */
  onBlur?: (event: any) => void
  /** Observe editing before `onValueChange`. The input event reports text that
   * has already changed; `preventDefault()` does not reject that text. */
  onInput?: (event: any) => void
  /** Observe keys before the wrapper's plain-Enter dismissal. `preventDefault()`
   * keeps that dismissal from running. Menu handles navigation and active-option
   * activation earlier, in document capture; this callback cannot veto those
   * actions. Composing keys remain with the input method. */
  onKeyDown?: (event: any) => void
}

/**
 * `<InputAutocomplete>` is a text field with a suggestion dropdown. Its value is
 * a free-form string. Text not in the list remains valid, and choosing a
 * suggestion fills the field. Use `Select` with `filter` when the value must be
 * one of the options.
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
    onFocus,
    onBlur,
    onInput,
    onKeyDown,
    filter = true,
    ...rest
  } = props

  const controlled = value !== undefined
  const [internal, setInternal] = useState<string>(defaultValue ?? '')
  const text = controlled ? value : internal
  // `open` is the intent; `menuOpen` also requires something to show, so an empty
  // (no-match) query never floats a blank popover. The Menu is controlled by it.
  const [open, setOpen] = useState(false)
  const options = useMemo(() => suggestions.map(normalizeOpt), [suggestions])
  const custom = typeof filter === 'function'
  const queryRe = filter !== false && !custom ? matchQueryRegex(text) : null
  const visible = custom
    ? options.filter((o) => (filter as (o: SelectOption, q: string) => boolean)(o, text))
    : options.filter((o) => matchesQuery(o, queryRe))
  const menuOpen = open && visible.length > 0

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
        defaultValue={defaultValue}
        // `data-menu-search` makes the menu treat THIS anchor as its combobox
        // field (see a-menu's #comboAnchor). The ARIA combobox contract: the field
        // is the `combobox` controlling a `listbox` (the Menu below), with the
        // active option associated directly with the focused native field by
        // a-menu, without renderer-local IDs.
        data-menu-search=""
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={menuOpen ? 'true' : 'false'}
        aria-autocomplete="list"
        onFocus={(e: any) => {
          onFocus?.(e)
          setOpen(true)
        }}
        onBlur={(e: any) => {
          onBlur?.(e)
          setOpen(false)
        }}
        onInput={(e: any) => {
          const next = e.currentTarget.value
          onInput?.(e)
          setText(next)
          setOpen(true)
        }}
        onKeyDown={(e: any) => {
          onKeyDown?.(e)
          // Menu arms active suggestions on keydown and clicks on keyup. Its
          // prevented event keeps this list open through that activation.
          if (e.key === 'Enter' && !e.defaultPrevented && !isComposingKey(e)) setOpen(false)
        }}
      />
      {/* Anchors to the field (its previous sibling). Controlled by `menuOpen`;
          user dismiss (Esc / outside-click) fires onStateChange, which we apply.
          `autoWidth` is omitted so the list floors to the field width. */}
      <Menu
        role="listbox"
        open={menuOpen}
        onStateChange={(_e: any, { next }: { next: boolean }) => {
          setOpen(next)
        }}
      >
        {visible.map((opt, i) => {
          const { className: optionClassName, style: optionStyle, ...optionAttrs } = optionPresentationAttrs(opt, true)
          return (
            <MenuItem
              key={`${opt.value}-${i}`}
              {...optionAttrs}
              role="option"
              tabIndex={-1}
              icon={opt.icon}
              label={highlight(opt.label ?? opt.value, queryRe)}
              hint={opt.hint ? highlight(opt.hint, queryRe) : opt.hint}
              tone={opt.tone}
              disabled={opt.disabled}
              value={opt.value}
              // Keep focus in the field on a mouse pick: preventing the row's
              // mousedown default stops it taking focus (it's tabIndex=0), so the
              // click still selects but focus never leaves the input.
              onMouseDown={(e: any) => e.preventDefault()}
              onSelect={() => pick(opt)}
              className={optionClassName}
              style={optionStyle}
            />
          )
        })}
      </Menu>
    </>
  )
}
