import type { ComposedCustom, ComposedSeries, CustomRenderContext, PixelResolver, RenderContext, Scale } from "../../types"
import { pixel_resolver } from "../../render/pixel_resolver"
import { color_resolver } from "../../template/color"

/**
 * Draw a custom series by handing the composed series and the render context to the caller's `renderer`
 * @param series - the composed custom series
 * @param render - the shared render context (canvas, inner rect, scales, fallback color, band categories)
 */
export function draw_custom<TooltipContent>(series: ComposedSeries<TooltipContent>, render: RenderContext): void {
    const custom = series as ComposedCustom<TooltipContent>
    const custom_render: CustomRenderContext = {
        ...render,
        ...custom_resolvers(custom, render.x_scale, render.y_scale),
        color_at: color_resolver(custom.colors, render.color),
    }

    try {
        custom.renderer(custom, custom_render)
    } catch (error) {
        console.warn('plot.custom: renderer threw, skipping this series.', error)
    }
}

// Build the pixel resolvers handed to a caller's renderer and hit test
export function custom_resolvers<TooltipContent>(
    series: ComposedCustom<TooltipContent>,
    x_scale: Scale,
    y_scale: Scale
): { resolve_x: PixelResolver; resolve_y: PixelResolver } {
    return {
        resolve_x: skip_unplaceable(pixel_resolver(x_scale, series.x)),
        resolve_y: skip_unplaceable(pixel_resolver(y_scale, series.y)),
    }
}

// Collapse every position a caller cannot draw at into undefined
function skip_unplaceable(resolve: PixelResolver): PixelResolver {
    return (i) => {
        const position = resolve(i)

        if (position === undefined || !Number.isFinite(position)) {
            return undefined
        }
        return position
    }
}
