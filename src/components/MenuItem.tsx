import type { BaseProps } from '../general_types'
import type { IconShape } from '../elements/a-icon.shapes'

export interface MenuItemProps extends BaseProps {
  /** Leading icon shape. */
  icon?: IconShape
  /** The item's text. Omit and pass `children` for richer content. */
  label?: string
  /** A trailing keyboard-shortcut hint, e.g. `"⌘E"`. */
  kbd?: string
  /** A trailing icon. On a `submenu` item this **overrides** the default
   *  chevron (omit it to keep the chevron); on a normal item it's the trailing
   *  glyph (omit for none). */
  iconTrailing?: IconShape
  /** Disable the item: greyed out, not focusable for activation, no close. */
  disabled?: boolean
  /** Mark the item as selected — a persistent background tint, the same resting
   *  fill a pressed row shows. The building block for single- / multi-select
   *  menus; leaves layout untouched (no reserved gutter). */
  selected?: boolean
  /** Semantic tone — colors the label, icon, and hover tint. `critical` is the
   *  destructive action; `neutral` (the default) is the standard gray.
   *  @defaultValue neutral */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical'
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
  kbd,
  iconTrailing,
  disabled,
  selected,
  tone,
  submenu,
  value,
  onSelect,
  className,
  children,
  ...rest
}: MenuItemProps) => {
  return (
    <a-menu-item
      role="menuitem"
      tabIndex={0}
      disabled={disabled ? '' : undefined}
      selected={selected ? '' : undefined}
      // 'neutral' is the implicit default — emit no DOM attribute.
      tone={tone && tone !== 'neutral' ? tone : undefined}
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
      {icon && <a-icon shape={icon} aria-hidden="true" />}
      {label != null && <a-menu-item-label>{label}</a-menu-item-label>}
      {/* Children sit after the label but before `kbd` and the trailing icon, so
          a slotted badge / counter (a `<Tag>`) lands just left of the shortcut
          hint / chevron rather than past it. The label's `flex: 1` right-aligns
          them. A submenu's nested `<a-menu>` is a child too, so it's no longer
          the item's last child — the `[submenu]`-scoped CSS positions the chevron
          without relying on that (see a-menu-item.css). */}
      {children}
      {kbd && <kbd>{kbd}</kbd>}
      {(() => {
        // A submenu shows the chevron by default; `iconTrailing` overrides it.
        const trailing = submenu ? (iconTrailing ?? 'chevron-right') : iconTrailing
        return trailing ? <a-icon shape={trailing} aria-hidden="true" /> : null
      })()}
    </a-menu-item>
  )
}
