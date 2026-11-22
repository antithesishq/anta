import type { BaseProps } from "../general_types"
import type { IconShape } from '../elements/a-icon.shapes'
import { neutralToneAttr, toneStyle } from "../anta_helpers"
import { Icon } from "./Icon"

export interface TagProps extends BaseProps {
  /** Displays a short status or a key before `value`. A label paired with a
   *  value uses a heavier weight; a label on its own uses the default weight. */
  label?: string
  /** Displays the tag's value, such as a count, version, or duration.
   *  When space is limited, the value truncates before the label. */
  value?: string
  /** Selects a semantic color. A CSS color defines a custom tone.
   *  @defaultValue neutral */
  tone?: 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
  /** Sets the emphasis: solid fill, subtle fill, or outline.
   *  @defaultValue secondary */
  priority?: 'primary' | 'secondary' | 'tertiary'
  /** Sets the tag's dimensions.
   *  @defaultValue medium */
  size?: 'small' | 'medium' | 'large'
  /** Displays the content in uppercase. The original text remains unchanged. */
  allcaps?: boolean
  /** Adds a decorative icon before the text. */
  icon?: IconShape
  /** Adds a decorative icon after the text. */
  iconTrailing?: IconShape
}

/**
 * Displays short statuses, counts, and metadata.
 *
 * Use `label` on its own or pair it with `value` for a key-value tag. Pass
 * child elements for several segments separated by dividers. Add `icon` or
 * `iconTrailing` for decorative icons.
 *
 * Tag is presentational. Wrap it in an anchor for navigation or place a
 * named Button inside it for removal. Keep navigation and removal as sibling
 * controls when both actions are needed.
 *
 * See [Install and configure](https://anta.design/install/) for stylesheet setup.
 *
 * @example Basic usage
 * ```tsx
 * <Tag tone="success" label="Passed" />
 * <Tag tone="info" icon="hourglass" label="Build" value="2m 14s" />
 * <Tag size="small" allcaps label="Running" />
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
  const toneAttr = neutralToneAttr(tone)
  const computedStyle = toneStyle(toneAttr, '--tag-tone-source', style)

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
      tone={toneAttr}
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
