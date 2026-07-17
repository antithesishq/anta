import { MenuItem, type MenuItemCommonProps, type MenuItemActionMode } from './MenuItem'
import { useState, useMemo } from '../jsx-runtime'

export type MenuItemCopyProps = MenuItemCommonProps & MenuItemActionMode

/** How long the success / failure feedback stays on the row (ms). */
const FEEDBACK_MS = 2000

/**
 * Copying menu item — a `MenuItem` preset for copy-to-clipboard rows inside a
 * `Menu`. Set `copy` for a literal string or `copyNode` to copy a DOM region;
 * the `<a-menu-item>` element performs the write when the row is chosen, and this
 * wrapper flips the leading icon to a check / ✕ and retones for ~2s.
 *
 * The menu closes on select by default, so the feedback shows only when the row
 * is kept open (`data-menu-open`). Defaults `label` to "Copy" and the leading
 * `icon` to `copy`; override either. Other props pass through — `tone`, `kbd`,
 * `copyLazy`, `onCopied`, `onCopyRequest`.
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
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  // useMemo([]) stands in for useRef (not re-exported by the jsx-runtime).
  const box = useMemo(() => ({ timer: undefined as ReturnType<typeof setTimeout> | undefined }), [])

  const handleCopied = (ok: boolean) => {
    clearTimeout(box.timer)
    setStatus(ok ? 'ok' : 'fail')
    box.timer = setTimeout(() => setStatus('idle'), FEEDBACK_MS)
    onCopied?.(ok)
  }

  const shownIcon = status === 'ok' ? 'check' : status === 'fail' ? 'x' : icon
  const shownTone = status === 'ok' ? 'success' : status === 'fail' ? 'critical' : tone

  return <MenuItem label={label} icon={shownIcon} tone={shownTone} onCopied={handleCopied} {...rest} />
}
