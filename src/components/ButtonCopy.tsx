import { Button, type ButtonProps } from './Button'
import { useState, useMemo } from '../jsx-runtime'

export type ButtonCopyProps = ButtonProps

/** How long the success / failure feedback stays on the button (ms). */
const FEEDBACK_MS = 2000

/**
 * Copy button — a `Button` preset for copy-to-clipboard. Set `copy` for a literal
 * string or `copyNode` to copy a DOM region; the `<a-button>` element performs
 * the write itself and reports the result, and this wrapper flips the leading
 * icon to a check (success) or ✕ (failure) and retones to `success` / `critical`
 * for ~2s — pure JSX re-render, no element state.
 *
 * With a `label` it's a labeled button; without one it's an icon-only copy
 * button. Everything else is a normal `Button` prop — `tone`, `priority`,
 * `size`, `icon` (the resting glyph), `copyLazy`, `onCopied`, `onCopyRequest`.
 *
 * @example
 * ```tsx
 * <ButtonCopy copy="npm i @antadesign/anta" label="Copy install" />
 * <ButtonCopy copy="https://anta.design" />          // icon-only
 * <ButtonCopy copyNode=".snippet" label="Copy block" priority="tertiary" />
 * ```
 */
export const ButtonCopy = ({ icon, tone, onCopied, ...rest }: ButtonCopyProps) => {
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail'>('idle')
  // Stable per-instance holder for the reset timer (useMemo with [] deps stands
  // in for useRef, which the jsx-runtime indirection doesn't re-export).
  const box = useMemo(() => ({ timer: undefined as ReturnType<typeof setTimeout> | undefined }), [])

  const handleCopied = (ok: boolean) => {
    clearTimeout(box.timer)
    setStatus(ok ? 'ok' : 'fail')
    box.timer = setTimeout(() => setStatus('idle'), FEEDBACK_MS)
    onCopied?.(ok)
  }

  // Swap only during the feedback window; otherwise the caller's own icon/tone.
  const shownIcon = status === 'ok' ? 'check' : status === 'fail' ? 'x' : icon
  const shownTone = status === 'ok' ? 'success' : status === 'fail' ? 'critical' : tone

  return <Button icon={shownIcon} tone={shownTone} onCopied={handleCopied} {...rest} />
}
