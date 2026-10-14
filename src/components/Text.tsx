import type { ATextAttributes, BaseProps, TextPresentation } from "../general_types"
import { lineClamp, nativeStateChange, neutralToneAttr, toneStyle } from "../anta_helpers"
import { useLayoutEffect, useMemo, useState } from '../jsx-runtime'
import { Tooltip } from "./Tooltip"

/** Expansion requires `truncate`. `expandableInert` and `collapsible` require
 *  `expandable`; dynamic boolean values are allowed. */
export type ExpandMode =
  | { expandable?: never; expandableInert?: never; collapsible?: never }
  | {
      /** Show a fade and expansion control when truncated text overflows.
       *  Select the control or focus it and press Enter or Space to reveal all
       *  content. Expansion is one-way: the control hides once expanded.
       *  Add `collapsible` to allow refolding. Requires `truncate`; disables the
       *  automatic tooltip. The control comes first in Tab order. By default,
       *  folded text stays selectable and its links remain focusable and clickable.
       *  Single-line text fades at the inline end with an inline-end target;
       *  multiline text fades over its last line with a full-width target.
       *  Folded content clips without scrolling or extra padding, and expansion
       *  preserves its width. */
      expandable: boolean
      /** Make the entire folded, overflowing preview an expand target.
       *  JSX applies `inert` to its content, blocking focus, clicks, and text
       *  selection and removing it from the accessibility tree until expanded.
       *  Fitting text stays interactive, as does server-rendered content before
       *  browser measurement. Requires `expandable`. */
      expandableInert?: boolean
      /** Allow refolding after expansion. The control stays visible, rotates
       *  its chevron, and switches between "Show more" and "Show less".
       *  Requires `expandable`. The expanded collapse target spans the full
       *  width over 16px of bottom padding; removing that padding with custom
       *  CSS allows it to overlap content. */
      collapsible?: boolean
    }

export type TextProps = BaseProps & {
  /** Text emphasis, from `primary` (`--text-1`, strongest) to `quaternary`
   *  (`--text-4`). `secondary` uses `--text-2`; `tertiary` uses `--text-3`.
   *  Neutral primary/secondary links use `--link-color` and `--link-color-hover`.
   *  Tertiary/quaternary links inherit the text color, with `--text-2` and
   *  `--text-3` respectively on hover.
   *  @defaultValue secondary */
  priority?: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  /** Color tint. `neutral` uses `--text-{N}`; named tones use
   *  `--text-{N}-{tone}`. A CSS color such as `rebeccapurple` keeps its hue,
   *  with lightness and chroma set per priority in oklch. With named tones,
   *  links inherit the text color and hover uses the next-stronger tone level;
   *  at `primary`, hover changes only the underline.
   *  @defaultValue neutral */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Font size / line height in pixels: `small` = 13/16, `medium` = 15/20,
   *  `large` = 17/24.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Render as inline-block instead of the default block element. */
  inline?: boolean
  /** Clamp with a trailing ellipsis: `true` or `1` selects one line, integers
   *  ≥ 2 select that many lines, and `0` or negative values disable truncation.
   *  Clipped, non-expandable Text shows its content in an automatic tooltip.
   *  Nest `<Tooltip>` to replace it or an empty tooltip to suppress it.
   *  Uses CSS `-webkit-line-clamp` in `display: -webkit-box`, with `min-width: 0`
   *  for flex and grid layouts. */
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
