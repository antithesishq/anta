import { MenuItem, type MenuItemCommonProps, type MenuItemActionMode } from './MenuItem'
import { useCopyFeedback } from '../anta_helpers'
import { type CopyTarget, copyElementProps, isNodeCopy } from './copy-props'

/** Action-mode menu-item props plus a required copy target (a copying row must
 *  copy something). */
export type MenuItemCopyProps = MenuItemCommonProps & MenuItemActionMode & CopyTarget

/**
 * Copying menu item — a `MenuItem` preset for copy-to-clipboard rows inside a
 * `Menu`. Set `copy` for a literal string, `copyNode` to copy a DOM region, or
 * `copyUrl` to copy the current page URL. For content computed on demand, keep
 * `copy` reactive and refresh it in `onCopyRequest` (fired on pointerdown / keydown).
 *
 * It composes a plain `<MenuItem>` with a slotted `<a-copy>` child that performs
 * the write when the row is chosen — the item itself carries no copy behavior.
 * The row is kept open (`data-menu-open`) so the feedback shows: this wrapper
 * flips the leading icon to a check / ✕ and retones for ~2s (see `useCopyFeedback`).
 *
 * Defaults `label` to "Copy" and the leading `icon` to `copy`; override either.
 * Other props pass through — `tone`, `kbd`, `onCopied`.
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
  const { shownIcon, shownTone, handleCopied } = useCopyFeedback(icon, tone, onCopied)
  const copyAttrs = copyElementProps({
    copy,
    copyNode,
    copyUrl,
    copyWithUrl,
    onCopyRequest,
    onCopied: handleCopied,
  } as CopyTarget)

  return (
    <MenuItem
      label={label}
      icon={shownIcon}
      tone={shownTone}
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
