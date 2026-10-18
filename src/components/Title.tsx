import type { BaseProps } from "../general_types"
import { lineClamp, neutralToneAttr, toneStyle } from "../anta_helpers"
import { Tooltip } from "./Tooltip"

export interface TitleProps extends BaseProps {
  /** Heading level, 1–6. Sets the type scale and the
   *  `aria-level` exposed to assistive technology
   *  (h1 is typically reserved for the page title).
   *  @defaultValue 2 */
  level?: 1 | 2 | 3 | 4 | 5 | 6
  /** Visual priority. Maps to text-1..text-4 (`primary` = text-1).
   *  @defaultValue primary */
  priority?: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  /** Color tint. `neutral` (the default) is the untinted `--text-{N}` scale; a
   *  named tone applies the matching `--text-{N}-{tone}` palette. Any literal CSS
   *  color (`'#ff1493'`, `'rebeccapurple'`) is a one-off custom tone — its hue is
   *  kept while lightness/chroma are pinned per priority in oklch.
   *  @defaultValue neutral */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Typeface. Serif names the page and its parts; sans serif names objects on
   *  the page, such as cards, panels, and metrics; monospace names technical
   *  identifiers, such as run IDs, hashes, and file paths. Omit it to let the
   *  theme choose by level: the Antithesis theme sets levels 1–3 in serif and
   *  4–6 in sans serif, and other themes use sans serif throughout. */
  font?: 'serif' | 'sans-serif' | 'monospace'
  /** Truncate with a trailing ellipsis. `true` (or `1`) clamps to a
   *  single line; any integer ≥ 2 clamps to that many lines; `0` or a
   *  negative value means no truncation. A clipped JSX `Title` shows its
   *  text content in a tooltip by default. Nest a `<Tooltip>` to provide
   *  your own tooltip instead.
   * @author Vlad Korobov
   */
  truncate?: boolean | number
}

/**
 * Block-level heading with level 1-6, priority, tone, and optional truncation.
 *
 * The wrapper supplies `role="heading"` and `aria-level`. Compose icons,
 * badges, and links as children. Title has no margins. Use the parent's `gap`
 * or padding to space it within a layout.
 *
 * Native `<h1>`–`<h6>` headings use the same type scale with document margins
 * when Anta's reset stylesheet is loaded.
 *
 * See [Install and configure](https://anta.design/install/) for stylesheet setup.
 *
 * @example Basic usage
 * ```tsx
 * <Title level={1}>Page title</Title>
 * <Title level={2} tone="brand">Section</Title>
 * <Title level={3} font="sans-serif">Run 4821: 12 failures</Title>
 * ```
 *
 * @example With children beyond text
 * ```tsx
 * <Title level={3}>
 *   <Icon shape="bookmark" /> Saved items
 * </Title>
 * ```
 */
export const Title = ({ level = 2, priority, tone, font, truncate, className, style, children, ...rest }: TitleProps) => {
  const lineCount = lineClamp(truncate)
  const toneAttr = neutralToneAttr(tone)
  const computedStyle = toneStyle(
    toneAttr,
    "--title-tone-source",
    lineCount != null ? { ...style, ['--line-clamp' as string]: lineCount } : style,
  )
  return (
    <a-title
      level={String(level)}
      priority={priority}
      tone={toneAttr}
      font={font}
      truncate={lineCount != null ? String(lineCount) : undefined}
      role="heading"
      aria-level={level}
      class={className}
      style={computedStyle}
      {...rest}
    >
      {children}
      {lineCount != null && (
        <Tooltip truncatedOnly data-anta-text-tooltip="" />
      )}
    </a-title>
  )
}
