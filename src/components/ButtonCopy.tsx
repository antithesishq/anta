import { Button, type ButtonProps } from './Button'
import { useCopyFeedback } from '../anta_helpers'

/** `ButtonProps` narrowed so a copy target is required — a copy button must copy
 *  something. Intersecting with the target union drops the "no copy prop" member
 *  of `CopyMode` (its `copy?: never` makes each combination `never`). */
export type ButtonCopyProps = ButtonProps &
  ({ copy: string } | { copyNode: boolean | string } | { copyUrl: true })

/**
 * Copy button — a `Button` preset for copy-to-clipboard. Set `copy` for a literal
 * string, `copyNode` to copy a DOM region, or `copyUrl` to copy the current page
 * URL. For content computed on demand, keep `copy` reactive and refresh it in
 * `onCopyRequest` (fired on pointerdown). The `<a-button>` element performs the
 * write and reports the result; this wrapper flips the leading icon to a check
 * (success) or ✕ (failure) and retones to `success` / `critical` for ~2s — a JSX
 * re-render, no element state (see `useCopyFeedback`).
 *
 * With a `label` it's a labeled button; without one it's an icon-only copy button.
 * Everything else is a normal `Button` prop — `tone`, `priority`, `size`, `icon`
 * (the resting glyph), `onCopied`.
 *
 * @example
 * ```tsx
 * <ButtonCopy copy="npm i @antadesign/anta" label="Copy install" />
 * <ButtonCopy copy="https://anta.design" />          // icon-only
 * <ButtonCopy copyNode=".snippet" label="Copy block" priority="tertiary" />
 * <ButtonCopy copyUrl label="Copy link" />           // copies location.href
 * <ButtonCopy copy={code} copyWithUrl label="Copy snippet" />  // code + source URL
 *
 * // Lazy: compute on pointerdown, copied on the click that follows.
 * const [report, setReport] = useState('')
 * <ButtonCopy copy={report} onCopyRequest={() => setReport(buildReport())} label="Copy report" />
 * ```
 */
export const ButtonCopy = ({ icon, tone, onCopied, ...rest }: ButtonCopyProps) => {
  const { shownIcon, shownTone, handleCopied } = useCopyFeedback(icon, tone, onCopied)
  return <Button icon={shownIcon} tone={shownTone} onCopied={handleCopied} {...rest} />
}
