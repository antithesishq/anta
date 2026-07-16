import type { BaseProps } from "../general_types"
import { toneStyle } from "../anta_helpers"

export interface TitleProps extends BaseProps {
  /** Heading level, 1-6. Drives font-size, line-height, and vertical
   *  rhythm. Also surfaced to assistive tech via `aria-level`
   *  (h1 is typically reserved for the page title).
   *  @defaultValue 2 */
  level?: 1 | 2 | 3 | 4 | 5 | 6
  /** Visual priority. Maps to text-1..text-5 (`primary` = text-1).
   *  @defaultValue primary */
  priority?: 'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'quinary'
  /** Color tint. `neutral` (the default) is the untinted `--text-{N}` scale; a
   *  named tone applies the matching `--text-{N}-{tone}` palette. Any literal CSS
   *  color (`'#ff1493'`, `'rebeccapurple'`) is a one-off custom tone — its hue is
   *  kept while lightness/chroma are pinned per priority in oklch.
   *  @defaultValue neutral */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
}

/**
 * Block-level heading with level 1-6, priority, and tone.
 *
 * Renders an `<a-title>` styled tag (no JS, no shadow DOM) with
 * `role="heading"` and `aria-level={level}` set by this wrapper for
 * accessibility. Children can be anything — text, icons, badges, links
 * — so there are no `icon` / `iconTrailing` props; just compose
 * inside.
 *
 * Raw `<h1>`-`<h6>` get the same visual styling via `src/reset.css`,
 * so use a real heading tag if SEO matters and you don't need the
 * `tone` / `priority` props.
 *
 * Styling notes (`a-title.css` ships comment-free): `<a-title>` is
 * intentionally CSS-only — no JS, no shadow DOM, not even
 * `customElements.define`; the browser treats it as a generic unknown
 * element and the CSS gives it block layout, the demi-bold variable-font
 * weight, and the per-level type scale + vertical rhythm. The matching
 * `h1`–`h6` rules in `src/reset.css` are kept in lockstep so raw markup
 * looks the same as `<Title level={n}>`. The tone × priority color matrix
 * has the same shape as `a-text`'s.
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
export const Title = ({ level = 2, priority, tone, className, style, children, ...rest }: TitleProps) => {
  // Empty string is "no tone" — normalize so it doesn't hit the custom-tone path.
  const toneAttr = tone || undefined
  return (
    <a-title
      level={String(level)}
      priority={priority}
      tone={toneAttr}
      role="heading"
      aria-level={level}
      class={className}
      style={toneStyle(toneAttr, "--title-tone-source", style)}
      {...rest}
    >
      {children}
    </a-title>
  )
}
