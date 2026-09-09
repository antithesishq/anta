import type { Dimensions } from '../compose/layout'
import type { ColorTheme, PlotTemplate } from '../types'
import { should_invert_color } from '../template/color'

const DARK_THEME_FILTER = 'invert(1) hue-rotate(180deg)'

/** An unpinned wrapper side fills its container; a pinned side follows the resolved canvas size. */
export function plot_wrapper_size(template: Partial<Dimensions>, canvas: Dimensions | null) {
    return {
        width: template.width === undefined ? '100%' : `${canvas?.width ?? template.width}px`,
        height: template.height === undefined ? '100%' : `${canvas?.height ?? template.height}px`,
    }
}

/** Invert dark-mode output only when the plot's color configuration calls for it. */
export function plot_color_filter<T>(
    template: Pick<PlotTemplate<T>, 'series' | 'background' | 'theme_invert'>,
    theme: ColorTheme,
): string | undefined {
    return theme === 'dark' && should_invert_color(template) ? DARK_THEME_FILTER : undefined
}
