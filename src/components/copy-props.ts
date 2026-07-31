import { nativeStateChange } from '../anta_helpers'

/**
 * The copy target for a copy preset (`ButtonCopy` / `MenuItemCopy`) — exactly
 * one of a literal string, a DOM region, or the page URL. The write itself is
 * performed by the slotted `<a-copy>` element; these props map to its attributes
 * via `copyElementProps`. `copyWithUrl` / `onCopyRequest` are only meaningful for
 * the string target, so the union pins them `never` elsewhere.
 */
export type CopyTarget =
  | {
      /** Text copied to the clipboard on activation. */
      copy: string
      /** Prefix the copied text with `// URL: <current page URL>`. */
      copyWithUrl?: boolean
      /** Compute the copy content lazily. Fires on pointerdown / keydown; update
       *  `copy` (a state change) here and the activation copies the latest value.
       *  The gap lets the update land even off the UI thread — only the
       *  serializable `copy` string crosses. */
      onCopyRequest?: () => void
      /** Fires after the copy attempt with whether it succeeded. */
      onCopied?: (ok: boolean) => void
      copyNode?: never
      copyUrl?: never
    }
  | {
      /** Copy a DOM node as rich text (`text/html`) + plain text. `true` copies
       *  the nearest ancestor marked `data-copy-source`; a string is a CSS
       *  selector for an ancestor region (`closest`). The copy control is stripped
       *  from the copied output. */
      copyNode: boolean | string
      /** Fires after the copy attempt with whether it succeeded. */
      onCopied?: (ok: boolean) => void
      copy?: never
      copyUrl?: never
      copyWithUrl?: never
      onCopyRequest?: never
    }
  | {
      /** Copy the current page URL (`location.href`). */
      copyUrl: true
      /** Fires after the copy attempt with whether it succeeded. */
      onCopied?: (ok: boolean) => void
      copy?: never
      copyNode?: never
      copyWithUrl?: never
      onCopyRequest?: never
    }

/** Everything `copyElementProps` reads: the target plus the resolved `onCopied`
 *  (the preset passes its feedback-wrapped handler) and the `toast` opt-in. */
type CopyElementInput = {
  copy?: string
  copyNode?: boolean | string
  copyUrl?: true
  copyWithUrl?: boolean
  onCopyRequest?: () => void
  onCopied?: (ok: boolean) => void
  toast?: boolean
  copiedLabel?: string
}

/** Project the copy-target props onto `<a-copy>` attributes + event handlers.
 *  Shared by `ButtonCopy` / `MenuItemCopy` so the mapping (and the cross-renderer
 *  `copydone` detail unwrap) lives in one place. */
export function copyElementProps(p: CopyElementInput) {
  const { copy, copyNode, copyUrl, copyWithUrl, onCopyRequest, onCopied, toast, copiedLabel } = p
  return {
    copy: copy != null ? copy : undefined,
    'copy-node': copyNode === true ? '' : typeof copyNode === 'string' ? copyNode : undefined,
    'copy-url': copyUrl ? '' : undefined,
    'copy-with-url': copyWithUrl ? '' : undefined,
    toast: toast ? '' : undefined,
    'copied-label': copiedLabel,
    oncopydone: onCopied
      ? (e: any) => onCopied(nativeStateChange<{ ok: boolean }>(e).detail?.ok ?? false)
      : undefined,
    oncopyrequest: onCopyRequest ? () => onCopyRequest() : undefined,
  } as const
}

/** True when these props copy a DOM node — the host control must then be marked
 *  `data-copy-node-button` so the serializer strips it from the copied region. */
export function isNodeCopy(p: { copyNode?: boolean | string }): boolean {
  return p.copyNode != null && p.copyNode !== false
}
