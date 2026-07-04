import type { BaseProps } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'
import { toneStyle } from '../anta_helpers'

export interface MenuItemProps extends BaseProps {
  /** Leading icon shape. */
  icon?: IconShape
  /** The item's text. Omit and pass `children` for richer content. */
  label?: string
  /** Secondary text under the label — explanatory copy, like `RadioGroup`'s
   *  option `hint`. Requires `label` (it stacks in a column beneath it). Muted
   *  (`--text-3`) and tracks the row's `tone`. */
  hint?: string
  /** A trailing keyboard-shortcut hint, e.g. `"⌘E"`. */
  kbd?: string
  /** A trailing icon. On a `submenu` item this **overrides** the default
   *  chevron (omit it to keep the chevron); on a normal item it's the trailing
   *  glyph (omit for none). */
  iconTrailing?: IconShape
  /** Disable the item: greyed out, not focusable for activation, no close. */
  disabled?: boolean
  /** Mark the item as selected. On a plain row (no `selectionIndicator`) this is
   *  a persistent background tint, the same resting fill a pressed row shows. On a
   *  checkable row (`selectionIndicator` set) it instead drives the leading
   *  `checkbox` / `radio` indicator and the row's `aria-checked`. */
  selected?: boolean
  /** Turn the row into a checkable item, driven by `selected` (the row stays the
   *  control and carries `aria-checked`):
   *  - `'checkbox'` → `role="menuitemcheckbox"`, a leading passive `<a-checkbox>`
   *    (before `icon`); the tint is dropped (the box carries state).
   *  - `'radio'` → `role="menuitemradio"`, a leading passive `<a-radio>`; tint dropped.
   *  - `'check'` → `role="menuitemradio"`, a trailing check glyph on the selected
   *    row *and* the background tint (the canonical single-select look).
   *  Omit for a plain row (the default). */
  selectionIndicator?: 'checkbox' | 'radio' | 'check'
  /** Only meaningful with `selectionIndicator="checkbox"`: render the box in the
   *  mixed state (`aria-checked="mixed"`) — e.g. a "Select all" row when some but
   *  not all of its options are selected. */
  indeterminate?: boolean
  /** Semantic tone — colors the label, icon, and hover/selected tint (and the
   *  `checkbox`/`radio` indicator, which adopts it). A named tone, or any literal
   *  CSS color (`'#ff1493'`, `'rebeccapurple'`) for a one-off custom tone whose
   *  hue + chroma are kept while the lightness is pinned to match the brand text.
   *  `critical` is the destructive action; `neutral` (the default) is the standard
   *  gray.
   *  @defaultValue neutral */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Marks this item as a submenu parent: adds the trailing chevron,
   *  `aria-haspopup="menu"`, and an `aria-expanded` baseline (kept in sync by
   *  the nested menu). Nest the flyout as a `<Menu>` child. */
  submenu?: boolean
  /** An opaque value identifying this item, handed back in `onSelect`'s detail
   *  so a shared handler can tell which row was chosen without a per-item
   *  closure. */
  value?: string | number
  /** Activation handler — fires when *this* item is chosen (click / Enter /
   *  Space), unless it's `disabled`. It does **not** fire for a submenu parent
   *  (clicking that opens the flyout, which isn't a selection) nor for a
   *  selection bubbling up from a nested submenu. Receives the event plus a
   *  `{ value, label }` detail. */
  onSelect?: (event: any, detail: { value?: string | number; label?: string }) => void
  /** Item content. With `label` set, children are extra content — most
   *  notably the nested `<Menu>` for a submenu parent. */
  children?: React.ReactNode
}

/**
 * MenuItem — a single selectable row inside a `Menu`. Composes a leading
 * `icon`, a `label` (or `children`), an optional trailing `kbd` hint, and an
 * optional trailing icon. For a submenu, set `submenu` and nest a
 * `<Menu>` as a child — a chevron is added automatically.
 *
 * Selecting an item closes the menu; add `data-menu-open` to keep it open
 * (toggles / multi-select) — it forwards to the element.
 *
 * @example
 * ```tsx
 * <MenuItem icon="copy" label="Duplicate" kbd="⌘D" onSelect={dup} />
 * <MenuItem label="Word wrap" data-menu-open onSelect={toggleWrap} />
 * <MenuItem label="Share" submenu>
 *   <Menu>
 *     <MenuItem label="Copy link" onSelect={copyLink} />
 *   </Menu>
 * </MenuItem>
 * ```
 */
export const MenuItem = ({
  icon,
  label,
  hint,
  kbd,
  iconTrailing,
  disabled,
  selected,
  selectionIndicator,
  indeterminate,
  tone,
  submenu,
  value,
  onSelect,
  className,
  style,
  children,
  ...rest
}: MenuItemProps) => {
  // A checkable row is the control itself: it flips role to menuitem{checkbox,radio}
  // and carries aria-checked. The leading `checkbox`/`radio` styles render a passive
  // <a-checkbox>/<a-radio> and drop the tint (the mark conveys state); the `check`
  // style instead keeps the tint and adds a trailing check glyph. So `selected=""`
  // (the tint) is emitted for plain rows *and* the `check` style.
  const checkable =
    selectionIndicator === 'checkbox' || selectionIndicator === 'radio' || selectionIndicator === 'check'
  const role =
    selectionIndicator === 'checkbox'
      ? 'menuitemcheckbox'
      : selectionIndicator === 'radio' || selectionIndicator === 'check'
        ? 'menuitemradio'
        : 'menuitem'
  const ariaChecked = !checkable
    ? undefined
    : selectionIndicator === 'checkbox' && indeterminate
      ? 'mixed'
      : selected
        ? 'true'
        : 'false'
  const keepTint = selected && (selectionIndicator === undefined || selectionIndicator === 'check')
  // A named tone travels as the attribute; a custom colour also needs its
  // `--{component}-tone-source` var set inline (the typed `attr()` path only
  // resolves on newer engines) — for the host and, so it adopts the row's tone,
  // the checkbox/radio indicator.
  const toneAttr = tone && tone !== 'neutral' ? tone : undefined
  return (
    <a-menu-item
      role={role}
      tabIndex={0}
      disabled={disabled ? '' : undefined}
      selected={keepTint ? '' : undefined}
      aria-checked={ariaChecked}
      // 'neutral' is the implicit default — emit no DOM attribute.
      tone={toneAttr}
      style={toneStyle(tone, '--menu-item-tone-source', style)}
      submenu={submenu ? '' : undefined}
      aria-haspopup={submenu ? 'menu' : undefined}
      // Resting baseline; the nested submenu's a-menu element reflects the
      // live open state onto this attribute (it owns that state).
      aria-expanded={submenu ? 'false' : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      onClick={
        disabled || !onSelect
          ? undefined
          : (e: any) => {
              // Only a genuine activation of THIS item fires onSelect. Skip a
              // submenu parent (its click opens the flyout, not a selection),
              // and skip a click bubbling up from a nested submenu item
              // (e.target's nearest item would be the child, not this row).
              if (submenu) return
              const t = e.target as Element | null
              if (t?.closest?.('a-menu-item') !== e.currentTarget) return
              onSelect(e, { value, label })
            }
      }
      class={className}
      {...rest}
    >
      {/* Passive selection indicator — reuses the checkbox/radio *element* visuals
          (no wrapper: no role, no focus, no form value). `aria-hidden` keeps the
          row the sole a11y node; a-menu-item.css zeroes its label gap + disables
          pointer events so the row owns the click. */}
      {selectionIndicator === 'checkbox' && (
        <a-checkbox
          aria-hidden="true"
          state={indeterminate ? 'indeterminate' : selected ? 'checked' : 'unchecked'}
          tone={toneAttr}
          style={toneStyle(tone, '--checkbox-tone-source')}
        />
      )}
      {selectionIndicator === 'radio' && (
        // Real boolean, not the ''/undefined presence form: `a-radio` has a
        // `selected` *property* setter (`applyState(!!on)`), so Preact routes the
        // prop through it — `''` would read as false and never select. A boolean
        // drives the property correctly and clears stale state on deselect. (The
        // checkbox above is safe: its `state` is attribute-only, no property.)
        <a-radio
          aria-hidden="true"
          selected={!!selected}
          tone={toneAttr}
          style={toneStyle(tone, '--radio-tone-source')}
        />
      )}
      {icon && <a-icon shape={icon} aria-hidden="true" />}
      {label != null &&
        (hint != null ? (
          // A hint stacks under the label in a column; the icon / kbd / trailing
          // icon stay in the row (the item's `align-items: center` centers them
          // against the two-line block).
          <a-menu-item-text>
            <a-menu-item-label>{label}</a-menu-item-label>
            <a-menu-item-hint>{hint}</a-menu-item-hint>
          </a-menu-item-text>
        ) : (
          <a-menu-item-label>{label}</a-menu-item-label>
        ))}
      {/* Children sit after the label but before `kbd` and the trailing icon, so
          a slotted badge / counter (a `<Tag>`) lands just left of the shortcut
          hint / chevron rather than past it. The label's `flex: 1` right-aligns
          them. A submenu's nested `<a-menu>` is a child too, so it's no longer
          the item's last child — the `[submenu]`-scoped CSS positions the chevron
          without relying on that (see a-menu-item.css). */}
      {children}
      {kbd && <kbd>{kbd}</kbd>}
      {(() => {
        // A submenu shows the chevron by default; `iconTrailing` overrides it. The
        // `check` selection style reserves a trailing slot on *every* row — a check
        // on the selected row, an invisible `blank` spacer on the rest — so the label
        // and end padding don't shift as the selection moves.
        let trailing = submenu ? (iconTrailing ?? 'chevron-right') : iconTrailing
        if (!submenu && !iconTrailing && selectionIndicator === 'check') trailing = selected ? 'check' : 'blank'
        return trailing ? <a-icon shape={trailing} aria-hidden="true" /> : null
      })()}
    </a-menu-item>
  )
}
