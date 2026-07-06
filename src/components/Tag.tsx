import type { BaseProps } from "../general_types"
import type { IconShape } from '../elements/a-icon.shapes'
import { toneStyle } from "../anta_helpers"
import { Icon } from "./Icon"

export interface TagProps extends BaseProps {
  /** A short "key" shown before the value. When paired with `value` it
   *  renders bold (weight 600), same color. On its own (no `value`) it's
   *  treated as the tag's primary text and keeps the default styling. */
  label?: string
  /** The tag's primary text — a status, count, version, duration, etc.
   *  Rendered in the default color and weight, with no divider from the
   *  label; the color + weight contrast does the separating. */
  value?: string
  /** Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`)
   *  for a one-off custom tone. Each tone renders the secondary tag style:
   *  `--text-3-{tone}` text over an alpha tint of the tone's hue (fill + a
   *  slightly stronger hairline border). A custom color is tinted the same
   *  way, with the text deepened to a readable foreground. `'neutral'` (the
   *  default) is the gray tag — the same as omitting `tone`.
   *  @defaultValue neutral */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Emphasis level. `secondary` (the default) is the subtle alpha-tint
   *  fill; `primary` is a solid fill with white text; `tertiary` is a
   *  transparent outline. Omitting it (or passing `'secondary'`) renders
   *  the default and emits no DOM attribute.
   *  @defaultValue secondary */
  priority?: 'primary' | 'secondary' | 'tertiary'
  /** Size variant. `small` = 16px tall, `medium` = 20px, `large` = 24px
   *  (matching `Button`). Omit the attribute or pass `'medium'` for the
   *  default — both render identically and emit no DOM attribute.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Render in all-caps instead of the default normal (mixed) case
   *  (uppercase tracks wider than the default body-text letter-spacing). */
  allcaps?: boolean
  /** Leading icon shape. Sits flush before the label, scaled to the pill. */
  icon?: IconShape
  /** Trailing icon shape. Renders last, after the value. */
  iconTrailing?: IconShape
}

/**
 * Compact pill / chip for status, labels, and metadata.
 *
 * Renders an `<a-tag>` styled tag (no JS, no shadow DOM) — color and size
 * come entirely from attributes. Content is composed from `icon`, `label`,
 * `value`, and `iconTrailing` (like `<Button>`): `value` is the primary
 * text (default styling) and `label`, when paired with a value, renders as
 * a bold "key" before it (same color, no divider). Tabular figures are
 * always on, so counts / versions / timers don't reflow. For an arbitrary
 * multi-part tag, pass `children` instead — each segment after the first
 * gets a hairline divider (the `label` + `value` pair is the no-divider
 * exception).
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only)
 * so the CSS ships with the page.
 *
 * Styling notes (`a-tag.css` ships comment-free):
 * - Sizing is intrinsic — no fixed height, like `<a-button>`: height falls
 *   out of `line-height` + `padding-block` + the 0.5px border (the base
 *   1.5px block padding compensates the half-pixel border to keep the pill
 *   at 20px), so text is never clipped and the padding tokens can be
 *   retuned freely. An edge icon trims ~2px off its side's padding
 *   (optical), and icons scale to `--tag-icon-size`.
 * - Color comes from the theme-aware semantic tokens, so named tones need
 *   no `.dark` rules; the hairline border and the segment divider both
 *   derive from `--tag-text`, so every tone gets a matching edge. A lone
 *   `label` is dropped into `<a-tag-value>` by this wrapper so it keeps the
 *   default weight; `<a-tag-label>` only renders as the bold key before a
 *   value (weight contrast does the separating — no divider).
 * - Segmented children: raw children (not the structured label/value/icon
 *   elements) get a hairline left border per segment after the first; the
 *   flex `gap` sits left of the border and `padding-left` balances it.
 * - Custom tones (any non-named `tone`) keep the source hue with
 *   lightness/chroma pinned via oklch relative color; the `--_tag-*` knobs
 *   are the only numbers to tune and the `.dark` block re-tunes them. The
 *   wrapper writes `--tag-tone-source` inline; a typed `attr()` fallback
 *   picks up raw `<a-tag tone="…">` on Chrome 133+/Safari 18.2+.
 * - `allcaps` switches on the uppercase transform and widens tracking to
 *   0.08ch (the default mixed case uses the body-text 0.02ch); tabular
 *   figures + `ss05` stay on. Each size steps down 1px under `allcaps`
 *   (uppercase reads larger than mixed case at the same px), with height
 *   unchanged.
 *
 * @example Basic usage
 * ```tsx
 * <Tag tone="success" label="Running" />
 * <Tag tone="info" icon="hourglass" label="Build" value="2m 14s" />
 * <Tag tone="brand" size="small" allcaps label="Status" />
 * ```
 */
export const Tag = ({
  icon,
  iconTrailing,
  label,
  value,
  tone,
  priority,
  size,
  allcaps,
  className,
  style,
  children,
  ...rest
}: TagProps) => {
  // A non-named tone is a literal CSS color: feed it to the element's oklch
  // derivation via the inline custom property (shared helper — see anta_helpers).
  const computedStyle = toneStyle(tone, '--tag-tone-source', style)

  // `value` is the primary text. A label only becomes the dim/bold "key"
  // when it has a value to sit before; a lone label is the primary text,
  // so it goes into <a-tag-value> to keep the default styling.
  const hasValue = value != null

  // An icon-only tag (no text content) has no accessible name — its only
  // content is a decorative (aria-hidden) icon. Derive one from the shape so
  // screen readers announce something; a consumer's own `aria-label` (via
  // ...rest) wins by spread order.
  const isIconOnly =
    icon != null && label == null && value == null && children == null && iconTrailing == null

  return (
    <a-tag
      tone={tone}
      aria-label={isIconOnly ? `${icon} tag` : undefined}
      // 'secondary' (and unset) is the implicit default — emit no DOM attr.
      priority={priority && priority !== 'secondary' ? priority : undefined}
      // 'medium' (and unset) is the implicit default — emit no DOM attr.
      size={size && size !== 'medium' ? size : undefined}
      // Boolean attribute: presence (empty string) on, omit off — the CSS
      // matches `[allcaps]` by presence, consistent across React / Preact.
      allcaps={allcaps ? '' : undefined}
      class={className}
      style={computedStyle}
      {...rest}
    >
      {icon && <Icon shape={icon} />}
      {label != null &&
        (hasValue
          ? <a-tag-label>{label}</a-tag-label>
          : <a-tag-value>{label}</a-tag-value>)}
      {hasValue && <a-tag-value>{value}</a-tag-value>}
      {children}
      {iconTrailing && <Icon shape={iconTrailing} />}
    </a-tag>
  )
}
