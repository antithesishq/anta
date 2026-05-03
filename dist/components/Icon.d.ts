import type { BaseProps } from "../general_types";
import type { IconShape } from '../elements/a-icon.shapes';
export interface IconProps extends BaseProps {
    /** Which icon to render. The set of valid shapes comes from Anta's
     *  built-in icons plus any consumer-generated shapes (via the
     *  `IconShapes` interface module augmentation). */
    shape: IconShape;
    /** Width and height in pixels. Defaults to `16`. */
    size?: number;
}
/**
 * Renders an `<a-icon>` web component. Color follows `currentColor`;
 * size is set via the `size` prop (defaults to 16).
 *
 * Requires `@antadesign/anta/elements` to be imported (client-side only)
 * to register the underlying custom element and load the icon
 * stylesheets.
 *
 * @example
 * ```tsx
 * import { Icon } from '@antadesign/anta'
 *
 * <Icon shape="chevron-down" />
 * <Icon shape="check" size={24} />
 * ```
 */
export declare const Icon: ({ shape, size, className, style, ...rest }: IconProps) => any;
