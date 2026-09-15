import type { CanvasContext, ComposedPlot, Layout, Rect, RenderContext } from "../types"
import { draw_axes, draw_grid, resolve_grid, continuous_axis_layout, type AxisChrome } from "./axes"
import { series_type } from "../registry"
import { DEFAULT_SERIES_COLOR, resolve_text_color } from "../template/color"

// Paint function: (context, plot) to pixels, on a CanvasRenderingContext2D or
// OffscreenCanvasRenderingContext2D so the same code runs in a Worker. No preact, no DOM
// globals. Per-series drawing is dispatched through the registry. `draw` is idempotent via
// save/restore.

const TITLE_SIZE = 14
const TITLE_COLOR = '#000'
const BORDER_COLOR = '#777'

/** Convert CSS dimensions to backing-store pixels using the same rounding for every canvas. */
export function canvas_pixel_size(width: number, height: number, dpr: number): { width: number; height: number } {
    return { width: Math.round(width * dpr), height: Math.round(height * dpr) }
}

/** Resize only when backing dimensions change, avoiding unnecessary canvas-state resets. */
export function resize_canvas(canvas: CanvasContext['canvas'], width: number, height: number, dpr: number): void {
    const pixels = canvas_pixel_size(width, height, dpr)
    if (canvas.width !== pixels.width || canvas.height !== pixels.height) {
        canvas.width = pixels.width
        canvas.height = pixels.height
    }
}

/** Prepare either canvas context to draw in CSS-pixel coordinates. */
export function prepare_canvas_context(ctx: CanvasContext, width: number, height: number, dpr: number): void {
    resize_canvas(ctx.canvas, width, height, dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

/**
 * Paint a ComposedPlot to the canvas: background, grid, title, axes, each series, then border. Idempotent via save/restore.
 * @param ctx - canvas context
 * @param plot - the ComposedPlot to render
 */
export function draw<TooltipContent = unknown>(ctx: CanvasContext, plot: ComposedPlot<TooltipContent>): void {
    ctx.save()
    try {
        const { layout, inner, x_scale, y_scale } = plot

        ctx.clearRect(0, 0, layout.width, layout.height)

        if (typeof plot.background === 'string') {
            draw_background(ctx, inner, plot.background)
        }

        // continuous tick layout is shared by the grid and the axis ticks, so compute it once here
        const chrome: AxisChrome = {
            layout,
            inner,
            x_axis: plot.x_axis,
            y_axis: plot.y_axis,
            x_scale,
            y_scale,
            theme: plot.chrome_theme,
            chrome_color: plot.chrome_color,
            x_ticks: continuous_axis_layout(ctx, 'x', x_scale, inner, plot.x_axis),
            y_ticks: continuous_axis_layout(ctx, 'y', y_scale, inner, plot.y_axis),
        }

        // grid sits above the background, below axes and series
        const grid = resolve_grid(plot.grid)

        if (grid.x || grid.y) {
            draw_grid(ctx, chrome, grid)
        }

        if (plot.title) {
            const title_color = resolve_text_color(plot.title_color, plot.chrome_theme, TITLE_COLOR)
            draw_title(ctx, layout, inner, plot.title, plot.title_size ?? TITLE_SIZE, title_color)
        }
        draw_axes(ctx, chrome)

        for (let series of plot.series) {
            const render: RenderContext = {
                ctx,
                inner,
                x_scale,
                y_scale,
                color: series.color ?? DEFAULT_SERIES_COLOR,
                x_categories: plot.x_categories,
                y_categories: plot.y_categories,
            }
            ctx.save()
            ctx.beginPath()
            ctx.rect(inner.left, inner.top, inner.right - inner.left, inner.bottom - inner.top)
            ctx.clip()

            try {
                series_type<TooltipContent>(series.kind).paint(series, render)
            } finally {
                ctx.restore()
            }
        }

        if (plot.border !== false) {
            draw_border(ctx, inner, layout, plot.chrome_color ?? BORDER_COLOR)
        }
    } finally {
        ctx.restore()
    }
}

/**
 * Fill the inner rect only, leaving the margin transparent.
 * @param ctx - canvas context
 * @param inner - inner plot rect
 * @param color - the resolved fill color
 */
function draw_background(ctx: CanvasContext, inner: Rect, color: string): void {
    ctx.save()
    ctx.fillStyle = color
    ctx.fillRect(inner.left, inner.top, inner.right - inner.left, inner.bottom - inner.top)
    ctx.restore()
}

/**
 * Draw a full frame around the plot area. Axis lines sit on its bottom and left edges.
 * @param ctx - canvas context
 * @param inner - inner plot rect
 * @param layout - resolved layout
 */
function draw_border(ctx: CanvasContext, inner: Rect, layout: Layout, color: string): void {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    // round then +0.5 so the frame lands crisp on a device pixel
    const left = Math.max(Math.round(inner.left) + 0.5, 0.5)
    const top = Math.max(Math.round(inner.top) + 0.5, 0.5)
    const right = Math.min(Math.round(inner.right) + 0.5, layout.width - 0.5)
    const bottom = Math.min(Math.round(inner.bottom) + 0.5, layout.height - 0.5)
    ctx.strokeRect(left, top, right - left, bottom - top)
    ctx.restore()
}

/**
 * Draw the title centered over the plot area, in the top margin band.
 * @param ctx - canvas context
 * @param layout - resolved layout
 * @param inner - inner plot rect
 * @param title - title text
 */
function draw_title(ctx: CanvasContext, layout: Layout, inner: Rect, title: string, size: number, color: string): void {
    ctx.save()
    ctx.fillStyle = color
    ctx.font = `${size}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(title, (inner.left + inner.right) / 2, layout.margin_top / 2)
    ctx.restore()
}
