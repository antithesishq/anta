import type { BaseProps } from "../general_types"
import { lineClamp, neutralToneAttr, toneStyle } from "../anta_helpers"
import { Tooltip } from "./Tooltip"

export interface TitleProps extends BaseProps {
  /** Sets the heading level and its font size.
   *  @defaultValue 2 */
  level?: 1 | 2 | 3 | 4 | 5 | 6
  /** Sets the title’s emphasis. See [Colors](/colors/#text).
   *  @defaultValue primary */
  priority?: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  /** Selects a text palette. Pass a CSS color to create a custom tone. See [Tone × priority](#tone--priority).
   *  @defaultValue neutral */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Use `serif` for page and section headings, `sans-serif` for headings in
   *  cards and panels, or `monospace` for identifiers like run IDs.
   *  Omit `font` to use the theme's default for the heading level. */
  font?: 'serif' | 'sans-serif' | 'monospace'
  /** Adds an ellipsis when the title exceeds the line limit. Use `true` for
   *  one line or a positive integer for the line count. Use `false` or `0`
   *  to disable truncation. Clipped titles show their full text in a tooltip.
   *  Nest a `<Tooltip>` to customize it.
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
