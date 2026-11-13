import type { ATextAttributes, BaseProps, TextPresentation } from "../general_types"
import { lineClamp, nativeStateChange, neutralToneAttr, toneStyle } from "../anta_helpers"
import { useMemo, useState } from '../jsx-runtime'
import { useNativeEventProps } from '../native-event-props'
import { Tooltip } from "./Tooltip"

/** Expansion requires `truncate`. `expandableInert` and `collapsible` require
 *  `expandable`; dynamic boolean values are allowed. */
export type ExpandMode =
  | { expandable?: never; expandableInert?: never; collapsible?: never }
  | {
      /** Shows a fade and a **Show more** control when truncated text overflows.
       *  Requires `truncate` and replaces the automatic tooltip. */
      expandable: boolean
      /** Makes the whole clipped preview an expansion target. Links and text
       *  selection become available after expansion. Requires `expandable`. */
      expandableInert?: boolean
      /** Keeps the control visible after expansion so readers can collapse
       *  the text again. Requires `expandable`. */
      collapsible?: boolean
    }

export type TextProps = BaseProps & {
  /** Controls text emphasis, from `primary` (strongest) to `quaternary`.
   *  See [Tones × priorities](#tones--priorities) for examples.
   *  @defaultValue secondary */
  priority?: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  /** Selects a text palette. A CSS color defines a custom tone.
   *  See [Tones × priorities](#tones--priorities) for examples.
   *  @defaultValue neutral */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Sets font size and line height: `small` 13/16 px, `medium` 15/20 px,
   *  and `large` 17/24 px.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Lets Text sit within a line as an inline block. */
  inline?: boolean
  /** Adds an ellipsis at the line limit. `true` limits text to one line,
   *  a positive integer sets the line count, and `false` or numbers below `1`
   *  disable truncation. Clipped text shows a tooltip when expansion is off.
   *  A nested `<Tooltip>` replaces it, and an empty tooltip suppresses it. */
  truncate?: boolean | number
} & ExpandMode

function ExpandableText({ attributes, children, expandableInert }: { attributes: ATextAttributes; children: React.ReactNode; expandableInert?: boolean }) {
  const [presentation, setPresentation] = useState<TextPresentation>({ expanded: false, overflowing: false })
  const onPresentation = useMemo(() => (input: Parameters<NonNullable<ATextAttributes['ontextpresentationchange']>>[0]) => {
    const { detail, isOwn } = nativeStateChange(input)
    if (!isOwn || !detail) return
    setPresentation(previous => previous.expanded === detail.expanded && previous.overflowing === detail.overflowing ? previous : detail)
  }, [])
  const eventProps = useNativeEventProps({ ontextpresentationchange: onPresentation })
  return (
    <a-text {...attributes} expandable-inert={expandableInert ? '' : undefined} {...eventProps}>
      <a-button role="button" tabIndex={0} priority="quaternary" paddingless="" />
      {/* Native inert is a boolean property; React 19 assigns it directly. */}
      <a-text-content inert={Boolean(expandableInert && presentation.overflowing && !presentation.expanded)}>{children}</a-text-content>
    </a-text>
  )
}

/**
 * Light-DOM text with priority, tone, truncation, and optional expansion.
 *
 * Renders `<a-text>` with priority-aware colors for content and links.
 * `inline` selects inline-block layout; `truncate` clamps text with an ellipsis.
 * Pair `expandable` with `truncate` to let the reader reveal all content.
 * Link underlines use 0.5px at 75% alpha, 1px at full alpha on hover,
 * and restore the resting underline while active.
 *
 * External CSS renders text and truncation before element registration.
 * The browser element measures overflow and owns expansion off-DOM.
 * Expandable Text places `a-button` before `a-text-content` in Tab order.
 * Granular expansion also requires `@antadesign/anta/elements/a-button`;
 * automatic tooltips require `@antadesign/anta/elements/a-tooltip`.
 *
 * @example Basic usage
 * ```tsx
 * <Text priority="secondary">Secondary emphasis</Text>
 * ```
 *
 * @example Expandable truncated text
 * ```tsx
 * <Text truncate={3} expandable>A long description that the reader can expand.</Text>
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
