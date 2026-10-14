import type { ATextAttributes, BaseProps, TextPresentation } from "../general_types"
import { lineClamp, nativeStateChange, neutralToneAttr, toneStyle } from "../anta_helpers"
import { useLayoutEffect, useMemo, useState } from '../jsx-runtime'
import { Tooltip } from "./Tooltip"

/** Truncation / expansion axis. `expandable` only takes effect with `truncate`;
 *  `collapsible` only with `expandable` — so the type forbids `collapsible`
 *  unless `expandable` is set (a dynamic `expandable={cond}` is still allowed). */
export type ExpandMode =
  | { expandable?: never; expandableInert?: never; collapsible?: never }
  | {
      /** Show a fade hint when text overflows and reserve space for an
       *  expansion control. Select the control or press Enter or Space while it
       *  has focus to reveal the text. Only takes effect with `truncate`.
       *  Expansion is one-way by default: the control is hidden once expanded.
       *  Add `collapsible` for a two-way toggle. */
      expandable: boolean
      /** Make overflowing, folded content inert and let the expand control cover
       *  the full preview. Content cannot receive focus, clicks, or selection and
       *  is excluded from the accessibility tree until expanded. Text that fits
       *  remains interactive. JSX owns the content's `inert` attribute. */
      expandableInert?: boolean
      /** Let the reader collapse back after expanding: the chevron becomes a
       *  "Show more" / "Show less" toggle that stays visible while expanded.
       *  Only takes effect together with `expandable`. */
      collapsible?: boolean
    }

export type TextProps = BaseProps & {
  /** Visual priority. Maps to text-1..text-4 (`primary` = text-1, the
   *  strongest). The default is `secondary` (text-2) — body text reads a
   *  step softer than the strongest foreground; pass `primary` for emphasis.
   *  @defaultValue secondary */
  priority?: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  /** Color tint. `neutral` (the default) is the untinted `--text-{N}` scale; a
   *  named tone applies the matching `--text-{N}-{tone}` palette. Any literal CSS
   *  color (`'#ff1493'`, `'rebeccapurple'`) is a one-off custom tone — its hue is
   *  kept while lightness/chroma are pinned per priority in oklch.
   *  @defaultValue neutral */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Type scale. `small` = 13/16, `medium` = 15/20, `large` = 17/24.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Render as inline-block instead of the default block element. */
  inline?: boolean
  /** Truncate with a trailing ellipsis. `true` (or `1`) clamps to a
   *  single line; any integer ≥ 2 clamps to that many lines; `0` or a
   *  negative value means no truncation. A clipped, non-expandable JSX
   *  `Text` shows its text content in a tooltip by default. Nest a
   *  `<Tooltip>` to provide your own tooltip instead. Uses the
   *  `-webkit-line-clamp` technique, supported in all major browsers
   *  (Firefox 68+, Chrome, Safari, Edge). */
  truncate?: boolean | number
} & ExpandMode

function ExpandableText({ attributes, children, expandableInert }: { attributes: ATextAttributes; children: React.ReactNode; expandableInert?: boolean }) {
  const [presentation, setPresentation] = useState<TextPresentation>({ expanded: false, overflowing: false })
  const [listening, setListening] = useState(false)
  // React hydration does not attach custom event props until they change.
  // This state-only commit installs the listener without reading the app DOM.
  useLayoutEffect(() => setListening(true), [])
  const onPresentation = useMemo(() => (input: Parameters<NonNullable<ATextAttributes['ontextpresentationchange']>>[0]) => {
    const { detail, isOwn } = nativeStateChange(input)
    if (!isOwn || !detail) return
    setPresentation(previous => previous.expanded === detail.expanded && previous.overflowing === detail.overflowing ? previous : detail)
  }, [])
  return (
    <a-text {...attributes} expandable-inert={expandableInert ? '' : undefined} ontextpresentationchange={listening ? onPresentation : undefined}>
      <a-button role="button" tabIndex={0} priority="quaternary" paddingless="" />
      {/* Native inert is a boolean property; React 19 assigns it directly. */}
      <a-text-content inert={Boolean(expandableInert && presentation.overflowing && !presentation.expanded)}>{children}</a-text-content>
    </a-text>
  )
}

/**
 * Block-level text container with priority and tone support.
 *
 * Renders an `<a-text>` light-DOM element that scopes its descendants'
 * color hierarchy. Links nested inside follow the design system's
 * priority-aware link styling. Pass `inline` for an inline-block
 * variant, `truncate` for ellipsis truncation, and `expandable`
 * (combined with `truncate`) to let the user reveal the full text.
 *
 * Text and truncation render with external CSS before registration. The browser
 * element measures overflow and owns expansion off-DOM. Expandable Text uses
 * an `a-button` control before `a-text-content`, so the control precedes content
 * links in Tab order. Granular usage also loads
 * `@antadesign/anta/elements/a-button`. Automatic tooltips need Tooltip's entry.
 *
 * @example Basic usage
 * ```tsx
 * <Text priority="secondary">Secondary emphasis</Text>
 * ```
 *
 * @example Expandable truncated text
 * ```tsx
 * <Text truncate={3} expandable>…long paragraph…</Text>
 * ```
 */
export const Text = ({ priority, tone, size, inline, truncate, expandable, collapsible, expandableInert, className, style, children, ...rest }: TextProps) => {
  const lineCount = lineClamp(truncate)
  const toneAttr = neutralToneAttr(tone)
  // A custom (non-named) tone writes --text-tone-source inline for the element's
  // oklch derivation; the line-clamp count rides along in the same style object.
  const computedStyle = toneStyle(
    toneAttr,
    "--text-tone-source",
    lineCount != null && lineCount > 1 ? { ...style, ['--line-clamp' as string]: lineCount } : style,
  )
  // expandable/collapsible only mean anything once the text is actually clamped.
  const canExpand = expandable && lineCount != null
  const attributes: ATextAttributes = {
    priority, tone: toneAttr, size, inline: inline ? '' : undefined,
    truncate: lineCount != null ? String(lineCount) : undefined,
    expandable: canExpand ? '' : undefined,
    collapsible: canExpand && collapsible ? '' : undefined,
    class: className, style: computedStyle as React.CSSProperties, ...rest,
  }
  if (canExpand) return <ExpandableText attributes={attributes} expandableInert={expandableInert}>{children}</ExpandableText>
  return (
    <a-text {...attributes}>
      {children}
      {lineCount != null && !canExpand && (
        <Tooltip truncatedOnly data-anta-text-tooltip="" />
      )}
    </a-text>
  )
}
