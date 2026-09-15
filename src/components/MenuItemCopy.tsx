import { MenuItem, type MenuItemCommonProps, type MenuItemActionMode } from './MenuItem'
import { useCopyFeedback } from '../anta_helpers'
import { type CopyTarget, copyElementProps, isNodeCopy } from './copy-props'
import type { IconShape } from '../elements/a-icon.shapes'

/** Action-mode menu-item props plus a required copy target (a copying row must
 *  copy something). The action-mode props that don't fit a copy row are pinned to
 *  `never`: `submenu` (a copy row has no flyout) and the selection-indicator axis
 *  (`selectionIndicator` / `indeterminate` / `indicator` — a copy row isn't a
 *  checkable option). Pinning (not `Omit`) keeps the intersection expanding fully
 *  in the docs props table. */
export type MenuItemCopyProps = MenuItemCommonProps &
  MenuItemActionMode & {
    submenu?: never
    selectionIndicator?: never
    indeterminate?: never
    indicator?: never
    iconTrailing?: never
  } & CopyTarget & {
    /** Where the copy glyph sits relative to the label — or `'none'` to omit it.
     *  Without a glyph, a successful copy shows a confirmation label near the
     *  pointer and leaves the row unchanged.
     *  @defaultValue 'leading' */
    iconPlacement?: 'leading' | 'trailing' | 'none'
    /** Text in the successful no-icon confirmation.
     *  @defaultValue Copied */
    copiedLabel?: string
  }

/**
 * Copying menu item — a `MenuItem` preset for copy-to-clipboard rows inside a
 * `Menu`. Set `copy` for a literal string, `copyNode` to copy a DOM region, or
 * `copyUrl` to copy the current page URL. For dynamic text, pass a controlled
 * `copy` string and set it in `onCopyRequest` before activation.
 *
 * It composes a plain `<MenuItem>` with a slotted `<a-copy>` child that performs
 * the write when the row is chosen — the item itself carries no copy behavior.
 * The row is kept open (`data-menu-open`) so the feedback shows: this wrapper
 * flips the leading icon to a check / ✕ and retones for ~2s (see `useCopyFeedback`).
 *
 * Defaults `label` to "Copy" and the leading `icon` to `copy`; override either.
 * `iconPlacement` moves that glyph to the trailing edge or omits it. Other props
 * pass through — `tone`, `kbd`, `onCopied`.
 *
 * @example
 * ```tsx
 * <Menu>
 *   <MenuItemCopy copy={shareUrl} label="Copy link" kbd="⌘C" />
 *   <MenuItemCopy copyNode=".invoice" label="Copy invoice" />
 * </Menu>
 * ```
 */
export const MenuItemCopy = ({
  label = 'Copy',
  icon = 'copy',
  iconPlacement = 'leading',
  copiedLabel,
  tone,
  onCopied,
  onCopyRequest,
  copy,
  copyNode,
  copyUrl,
  copyWithUrl,
  children,
  ...rest
}: MenuItemCopyProps) => {
  const restingIcon: IconShape | undefined = iconPlacement === 'none' ? undefined : icon
  const { shownIcon, shownTone, handleCopied } = useCopyFeedback(restingIcon, tone, onCopied)
  const iconSlot =
    iconPlacement === 'trailing'
      ? { iconTrailing: shownIcon }
      : iconPlacement === 'none'
        ? {}
        : { icon: shownIcon }
  const copyAttrs = copyElementProps({
    copy,
    copyNode,
    copyUrl,
    copyWithUrl,
    onCopyRequest,
    onCopied: handleCopied,
    toast: iconPlacement === 'none',
    copiedLabel,
  })

  return (
    <MenuItem
      label={label}
      tone={shownTone}
      {...iconSlot}
      // Keep the menu open on select so the icon / tone feedback is visible (a
      // closing row would tear down before the swap shows). For `copyNode`, mark
      // the row so the serializer strips it from the copied region.
      data-menu-open=""
      data-copy-node-button={isNodeCopy({ copyNode }) ? '' : undefined}
      {...rest}
    >
      {children}
      <a-copy {...copyAttrs} />
    </MenuItem>
  )
}
