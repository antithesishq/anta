import type { BaseProps } from "../general_types"
import type { IconShape } from '../elements/a-icon.shapes'

export interface IconProps extends BaseProps {
  /** Which icon to render. The set of valid shapes comes from Anta's
   *  built-in icons plus any consumer-generated shapes (via the
   *  `IconShapes` interface module augmentation). */
  shape: IconShape
  /** Width and height in pixels. Defaults to `16`. */
  size?: number
  /** Accessible name for the icon. When set, the wrapper exposes
   *  `role="img"` and `aria-label={label}` so screen readers announce
   *  the icon. When omitted (the default), the icon is treated as
   *  decorative — `aria-hidden="true"` is applied so it doesn't add
   *  noise alongside neighbouring text. */
  label?: string
}

/**
 * Renders an `<a-icon>` web component. Color follows `currentColor`;
 * size is set via the `size` prop (defaults to 16).
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only)
 * to register the underlying custom element and load the icon
 * stylesheets.
 *
 * @example Decorative icon paired with text — no label needed
 * ```tsx
 * <button>
 *   <Icon shape="trash" />
 *   Delete
 * </button>
 * ```
 *
 * @example Meaningful icon-only control — pass a label
 * ```tsx
 * <button aria-label="Delete">
 *   <Icon shape="trash" label="Delete" />
 * </button>
 * ```
 */
export const Icon = ({ shape, size, label, className, style, ...rest }: IconProps) => {
  const sizedStyle = size != null
    ? { ...style, ['--icon-size' as string]: `${size}px` }
    : style
  // ARIA wiring lives in the JSX wrapper, not the web component.
  const a11y: { role?: string; 'aria-label'?: string; 'aria-hidden'?: 'true' } = label != null
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': 'true' }
  return (
    <a-icon
      shape={shape}
      class={className}
      style={sizedStyle as React.CSSProperties}
      {...a11y}
      {...rest}
    />
  )
}
