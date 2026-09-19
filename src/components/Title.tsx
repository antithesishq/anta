import type { BaseProps } from "../general_types"
import { lineClamp, neutralToneAttr, toneStyle } from "../anta_helpers"
import { Tooltip } from "./Tooltip"

export interface TitleProps extends BaseProps {
  /** Heading level, 1-6. Drives font-size, line-height, and vertical
   *  rhythm. Also surfaced to assistive tech via `aria-level`
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
  /** Truncate with a trailing ellipsis. `true` (or `1`) clamps to a
   *  single line; any integer ≥ 2 clamps to that many lines; `0` or a
   *  negative value means no truncation. A clipped JSX `Title` shows its
   *  text content in a tooltip by default. Nest a `<Tooltip>` to provide
   *  your own tooltip instead. */
  truncate?: boolean | number
}

/**
 * Block-level heading with level 1-6, priority, tone, and optional truncation.
 *
 * Renders an `<a-title>` styled tag (no JS, no shadow DOM) with
 * `role="heading"` and `aria-level={level}` set by this wrapper for
 * accessibility. Children can be anything — text, icons, badges, links
 * — so there are no `icon` / `iconTrailing` props; compose
 * inside.
 *
 * `<Title>` carries no vertical margins: it's a spacing-neutral atom
 * that drops into any container, and the parent owns spacing (a `gap`
 * or padding). Raw `<h1>`-`<h6>` do keep per-level top/bottom margins
 * (via `src/reset.css`) for document prose rhythm — so use a real
 * heading tag if SEO matters or you want that built-in rhythm and don't
 * need the `tone` / `priority` props.
 *
 * Styling notes (`a-title.css` ships comment-free): `<a-title>` is
 * intentionally CSS-only — no JS, no shadow DOM, not even
 * `customElements.define`; the browser treats it as a generic unknown
 * element and the CSS gives it block layout, the demi-bold variable-font
 * weight, and the per-level type scale. The matching `h1`–`h6` rules in
 * `src/reset.css` share that type scale and weight, so raw markup reads
 * the same as `<Title level={n}>` — they diverge only on margins: raw
 * headings carry the document vertical rhythm, `<a-title>` is margin-free.
 * The tone × priority color matrix has the same shape as `a-text`'s.
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only)
 * so the CSS ships with the page.
 *
 * @example Basic usage
 * ```tsx
 * <Title level={1}>Page title</Title>
 * <Title level={2} tone="brand">Section</Title>
 * ```
 *
 * @example With children beyond text
 * ```tsx
 * <Title level={3}>
 *   <Icon shape="bookmark" /> Saved items
 * </Title>
 * ```
 */
export const Title = ({ level = 2, priority, tone, truncate, className, style, children, ...rest }: TitleProps) => {
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
