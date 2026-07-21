import { MenuItem, type MenuItemCommonProps, type MenuItemActionMode } from './MenuItem'
import type { CopyMode } from './Button'
import { useCopyFeedback } from '../anta_helpers'

/** The action-mode menu-item props plus a required copy target (a copying row
 *  must copy something). The target intersection drops `CopyMode`'s "no copy
 *  prop" member. */
export type MenuItemCopyProps = MenuItemCommonProps &
  MenuItemActionMode &
  CopyMode &
  ({ copy: string } | { copyNode: boolean | string } | { copyUrl: true })

/**
 * Copying menu item — a `MenuItem` preset for copy-to-clipboard rows inside a
 * `Menu`. Set `copy` for a literal string, `copyNode` to copy a DOM region, or
 * `copyUrl` to copy the current page URL. For content computed on demand, keep
 * `copy` reactive and refresh it in `onCopyRequest` (fired on pointerdown). The
 * `<a-menu-item>` element performs the write when the row is chosen; this wrapper
 * flips the leading icon to a check / ✕ and retones for ~2s (see `useCopyFeedback`).
 *
 * The menu closes on select by default, so the feedback shows only when the row
 * is kept open (`data-menu-open`). Defaults `label` to "Copy" and the leading
 * `icon` to `copy`; override either. Other props pass through — `tone`, `kbd`,
 * `onCopied`.
 *
 * @example
 * ```tsx
 * <Menu>
 *   <MenuItemCopy copy={shareUrl} label="Copy link" kbd="⌘C" />
 *   <MenuItemCopy copyNode=".invoice" label="Copy invoice" data-menu-open />
 * </Menu>
 * ```
 */
export const MenuItemCopy = ({ label = 'Copy', icon = 'copy', tone, onCopied, ...rest }: MenuItemCopyProps) => {
  const { shownIcon, shownTone, handleCopied } = useCopyFeedback(icon, tone, onCopied)
  return <MenuItem label={label} icon={shownIcon} tone={shownTone} onCopied={handleCopied} {...rest} />
}
