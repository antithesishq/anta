import type { PlotController } from '../controller'
import type { ColorTheme, Rect, ThemeColor } from '../types'
import { resolve_theme_color } from '../template/color'
import { zoom_pan_enabled } from '../interactions/zoom_pan'

const EDGE_INSET = 8
const BACKGROUND: ThemeColor = {
    light: 'rgba(242, 241, 242, 0.7)',
    dark: 'rgba(18, 16, 19, 0.7)',
}

export const RESET_ZOOM_BUTTON = {
    priority: 'secondary',
    size: 'small',
    label: 'Reset zoom',
    iconTrailing: 'rotate-ccw',
} as const

/** Shared Anta button presentation; hosts mount it in their own overlay and stacking context. */
export function reset_zoom_presentation<T>(controller: PlotController<T>, inner: Rect, theme: ColorTheme) {
    return {
        visible: zoom_pan_enabled(controller.template)
            && controller.interactions.is_zoomed(controller.template.zoom_pan),
        position: {
            position: 'absolute' as const,
            left: `${inner.left + EDGE_INSET}px`,
            top: `${inner.top + EDGE_INSET}px`,
        },
        button: {
            ...RESET_ZOOM_BUTTON,
            style: {
                backgroundColor: resolve_theme_color(BACKGROUND, theme),
                padding: '5px',
            },
        },
    }
}
