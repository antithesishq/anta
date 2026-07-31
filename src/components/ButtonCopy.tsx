import { Button, type ButtonProps } from './Button'
import { useCopyFeedback } from '../anta_helpers'
import { type CopyTarget, copyElementProps, isNodeCopy } from './copy-props'
import type { IconShape } from '../elements/a-icon.shapes'

/** A copy button is a plain action control, so `ButtonCopy` keeps the `Button`
 *  axes that fit — tone / size / priority styling, `disabled` / `loading`, a
 *  leading `icon` + `label` — and pins the ones that don't to `never`: `selected`
 *  (it isn't a toggle), the whole submit/link axis (`href` / `target` / `rel` /
 *  `download` / `ping` / `type` / `form` — a copy button neither navigates nor
 *  submits), and the public `iconTrailing` (the glyph's side is `iconPlacement`'s
 *  job). Plus a required copy target and the placement knob. (Pinning to `never`
 *  keeps the intersection expanding fully in the docs props table, which `Omit`
 *  wouldn't.) */
export type ButtonCopyProps = ButtonProps & {
  selected?: never
  href?: never
  target?: never
  rel?: never
  download?: never
  ping?: never
  type?: never
  form?: never
  iconTrailing?: never
} & CopyTarget & {
    /** Where the copy glyph sits relative to the label — or `'none'` to omit it.
     *  Without a glyph, a successful copy shows a small confirmation label near
     *  the pointer and leaves the button unchanged.
     *  @defaultValue 'leading' */
    iconPlacement?: 'leading' | 'trailing' | 'none'
    /** Text in the successful no-icon confirmation.
     *  @defaultValue Copied */
    copiedLabel?: string
  }

/**
 * Copy button — a `Button` preset for copy-to-clipboard. Set `copy` for a literal
 * string, `copyNode` to copy a DOM region, or `copyUrl` to copy the current page
 * URL. For content computed on demand, keep `copy` reactive and refresh it in
 * `onCopyRequest` (fired on pointerdown / keydown).
 *
 * It composes a plain `<Button>` with a slotted `<a-copy>` child that performs
 * the write — the button itself carries no copy behavior. This wrapper flips the
 * copy glyph to a check (success) or ✕ (failure) and retones to `success` /
 * `critical` for ~2s (a re-render, no element state — see `useCopyFeedback`).
 * `iconPlacement` puts that glyph leading (default), trailing, or `'none'`; with
 * `'none'`, `<a-copy>` shows its `Copied` confirmation instead.
 *
 * With a `label` it's a labeled button; without one it's an icon-only copy button
 * (named "Copy" for assistive tech). Everything else is a normal `Button` prop —
 * `tone`, `priority`, `size`, `icon` (the resting glyph), `onCopied`.
 *
 * @example
 * ```tsx
 * <ButtonCopy copy="npm i @antadesign/anta" label="Copy install" />
 * <ButtonCopy copy="https://anta.design" />                     // icon-only
 * <ButtonCopy copy={code} label="Copy" iconPlacement="trailing" />
 * <ButtonCopy copy={code} label="Copy snippet" iconPlacement="none" copiedLabel="Copied" />
 * <ButtonCopy copyNode=".snippet" label="Copy block" priority="tertiary" />
 * <ButtonCopy copyUrl label="Copy link" />                      // copies location.href
 * ```
 */
export const ButtonCopy = ({
  icon,
  iconPlacement = 'leading',
  copiedLabel,
  tone,
  onCopied,
  onCopyRequest,
  copy,
  copyNode,
  copyUrl,
  copyWithUrl,
  label,
  children,
  'aria-label': ariaLabel,
  ...rest
}: ButtonCopyProps) => {
  // Resting glyph: the copy icon by default, a consumer `icon` overrides it, and
  // `'none'` drops it entirely (the confirmation label is the feedback then).
  const restingIcon: IconShape | undefined = iconPlacement === 'none' ? undefined : (icon ?? 'copy')
  const { shownIcon, shownTone, handleCopied } = useCopyFeedback(restingIcon, tone, onCopied)

  // Feed the (swapping) glyph into the chosen slot; `'none'` uses neither.
  const iconSlot =
    iconPlacement === 'trailing'
      ? { iconTrailing: shownIcon }
      : iconPlacement === 'none'
        ? {}
        : { icon: shownIcon }

  const hasText = label != null || children != null
  const copyAttrs = copyElementProps({
    copy,
    copyNode,
    copyUrl,
    copyWithUrl,
    onCopyRequest,
    onCopied: handleCopied,
    // The top-layer confirmation only appears when there is no glyph to swap.
    toast: iconPlacement === 'none',
    copiedLabel,
  })

  return (
    <Button
      {...iconSlot}
      label={label}
      tone={iconPlacement === 'none' ? tone : shownTone}
      // Icon-only (no visible text) gets an accessible name; a consumer's own
      // `aria-label` wins.
      aria-label={ariaLabel ?? (hasText ? undefined : 'Copy')}
      // For `copyNode`, mark the whole button so the serializer strips it (and
      // its `<a-copy>` child) from the copied region.
      data-copy-node-button={isNodeCopy({ copyNode }) ? '' : undefined}
      {...rest}
    >
      {children}
      <a-copy {...copyAttrs} />
    </Button>
  )
}
