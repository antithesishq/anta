import type { BaseProps } from "../general_types"
import type { IconShape } from '../elements/a-icon.shapes'

export interface IconProps extends BaseProps {
  /** Which icon to render. The set of valid shapes comes from Anta's
   *  built-in icons plus any consumer-generated shapes (via the
   *  `IconShapes` interface module augmentation). */
  shape: IconShape
  /** Width and height in pixels.
   *  @defaultValue 16 */
  size?: number
  /** Accessible name for the icon. When set, the wrapper exposes
   *  `role="img"` and `aria-label={label}` so screen readers announce
   *  the icon. When omitted (the default), the icon is treated as
   *  decorative — `aria-hidden="true"` is applied so it doesn't add
   *  noise alongside neighbouring text. */
  label?: string
}

/**
 * Displays an icon in the current text color. Pass `size` for custom dimensions
 * and `label` when the icon conveys meaning without accompanying text.
 *
 * Icon needs CSS without element registration. See
 * [Install and configure](https://anta.design/install/) for stylesheet setup.
 *
 * @example Decorative icon beside status text
 * ```tsx
 * <Text><Icon shape="check" /> Saved</Text>
 * ```
 *
 * @example Standalone icon with an accessible name
 * ```tsx
 * <Icon shape="warning-triangle" label="Warning" />
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
