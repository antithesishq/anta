import type { BaseProps } from "../general_types"
import { toneStyle } from "../anta_helpers"

/** Truncation / expansion axis. `expandable` only takes effect with `truncate`;
 *  `collapsible` only with `expandable` — so the type forbids `collapsible`
 *  unless `expandable` is set (a dynamic `expandable={cond}` is still allowed). */
export type ExpandMode =
  | { expandable?: never; collapsible?: never }
  | {
      /** Show a fade hint and chevron over the truncated text and let the user
       *  expand it by clicking the chevron region or pressing Enter while the
       *  chevron has keyboard focus. Only takes effect together with `truncate`.
       *  On its own, expanding is **one-way** — the control is removed once
       *  expanded; add `collapsible` for a two-way toggle. */
      expandable: boolean
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
   *  negative value means no truncation. Uses the `-webkit-line-clamp`
   *  technique, supported in all major browsers (Firefox 68+, Chrome,
   *  Safari, Edge). */
  truncate?: boolean | number
} & ExpandMode

/**
 * Block-level text container with priority and tone support.
 *
 * Renders an `<a-text>` web component that scopes its descendants'
 * color hierarchy. Links nested inside follow the design system's
 * priority-aware link styling. Pass `inline` for an inline-block
 * variant, `truncate` for ellipsis truncation, and `expandable`
 * (combined with `truncate`) to let the user reveal the full text.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only)
 * to register the underlying custom element.
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
export const Text = ({ priority, tone, size, inline, truncate, expandable, collapsible, className, style, children, ...rest }: TextProps) => {
  // 0 / a negative value means "no truncation" — never clamp to zero lines
  // (which would hide all the text). `true` → 1, any integer ≥ 1 → that count.
  const n = typeof truncate === 'number' ? truncate : truncate ? 1 : null
  const lineCount = n != null && n >= 1 ? n : null
  // Empty string is "no tone" — normalize so it doesn't hit the custom-tone path
  // (an empty `--text-tone-source` would break the oklch derivation).
  const toneAttr = tone || undefined
  // A custom (non-named) tone writes --text-tone-source inline for the element's
  // oklch derivation; the line-clamp count rides along in the same style object.
  const computedStyle = toneStyle(
    toneAttr,
    "--text-tone-source",
    lineCount != null ? { ...style, ['--line-clamp' as string]: lineCount } : style,
  )
  // expandable/collapsible only mean anything once the text is actually clamped.
  const canExpand = expandable && lineCount != null
  return (
    <a-text
      priority={priority}
      tone={toneAttr}
      size={size}
      inline={inline ? '' : undefined}
      truncate={lineCount != null ? String(lineCount) : undefined}
      expandable={canExpand ? '' : undefined}
      collapsible={canExpand && collapsible ? '' : undefined}
      class={className}
      style={computedStyle as React.CSSProperties}
      {...rest}
    >
      {children}
    </a-text>
  )
}
