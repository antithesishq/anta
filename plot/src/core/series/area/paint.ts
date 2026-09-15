import type { AreaPixelRuns, ComposedArea, RenderContext } from "../../types"
import { is_vertical_area, run_count, series_pixel_runs } from "./layout"

const DEFAULT_STROKE_WIDTH = 1

/**
 * Draw an area series: the band between the two boundaries, filled in the series color and clipped to the
 * plot area. With `stroke` set, each boundary that comes from data is outlined (a zero baseline isn't).
 * @param series - the area series
 * @param render - the shared render context (canvas, inner rect, scales, fallback color)
 */
export function draw_area(series: ComposedArea, render: RenderContext): void {
    const { ctx, x_scale, y_scale, color } = render
    const runs = series_pixel_runs(series, x_scale, y_scale)
    const runs_drawn = run_count(runs)

    if (runs_drawn === 0) {
        return
    }
    const vertical = is_vertical_area(series)
    const has_data_base = series.x2 !== undefined || series.y2 !== undefined
    ctx.fillStyle = color

    for (let run = 0; run < runs_drawn; run++) {
        fill_run(ctx, runs, runs.run_starts[run], runs.run_starts[run + 1], vertical)
    }

    if (series.stroke !== undefined) {
        stroke_runs(ctx, runs, series.stroke, series.dash, has_data_base, vertical)
    }
}

/**
 * Fill one run: forward along the first boundary, back along the second, closed.
 * @param ctx - canvas context
 * @param runs - the band's pixel runs
 * @param start - the run's first point
 * @param end - one past the run's last point
 * @param vertical - whether the band rides the y axis
 */
function fill_run(ctx: RenderContext['ctx'], runs: AreaPixelRuns, start: number, end: number, vertical: boolean): void {
    // a lone point spans no width, so it fills nothing
    if (end - start < 2) {
        return
    }
    ctx.beginPath()
    move_to(ctx, runs.along[start], runs.edge[start], vertical)

    for (let i = start + 1; i < end; i++) {
        line_to(ctx, runs.along[i], runs.edge[i], vertical)
    }

    for (let i = end - 1; i >= start; i--) {
        line_to(ctx, runs.along[i], runs.base[i], vertical)
    }
    ctx.closePath()
    ctx.fill()
}

/**
 * Outline each run's boundaries in the stroke color.
 * @param ctx - canvas context
 * @param runs - the band's pixel runs
 * @param stroke - the resolved stroke
 * @param dash - the boundary dash pattern, or undefined for solid
 * @param has_data_base - whether the second boundary is a data column (a synthetic baseline isn't drawn)
 * @param vertical - whether the band rides the y axis
 */
function stroke_runs(ctx: RenderContext['ctx'], runs: AreaPixelRuns, stroke: { color: string; width?: number }, dash: number[] | undefined, has_data_base: boolean, vertical: boolean): void {
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width ?? DEFAULT_STROKE_WIDTH
    ctx.setLineDash(dash ?? [])
    const runs_drawn = run_count(runs)

    for (let run = 0; run < runs_drawn; run++) {
        const start = runs.run_starts[run]
        const end = runs.run_starts[run + 1]
        stroke_boundary(ctx, runs.along, runs.edge, start, end, vertical)

        if (has_data_base) {
            stroke_boundary(ctx, runs.along, runs.base, start, end, vertical)
        }
    }
}

/**
 * Stroke one boundary of a run as a polyline.
 * @param ctx - canvas context
 * @param along - the free-axis pixels
 * @param across - the boundary's paired-axis pixels
 * @param start - the run's first point
 * @param end - one past the run's last point
 * @param vertical - whether the band rides the y axis
 */
function stroke_boundary(ctx: RenderContext['ctx'], along: Float64Array, across: Float64Array, start: number, end: number, vertical: boolean): void {
    if (end - start < 2) {
        return
    }
    ctx.beginPath()
    move_to(ctx, along[start], across[start], vertical)

    for (let i = start + 1; i < end; i++) {
        line_to(ctx, along[i], across[i], vertical)
    }
    ctx.stroke()
}

/**
 * Move to a point in the band's own axes, mapped to canvas x/y by orientation.
 * @param ctx - canvas context
 * @param along - the pixel on the free axis
 * @param across - the pixel on the paired axis
 * @param vertical - whether the band rides the y axis
 */
function move_to(ctx: RenderContext['ctx'], along: number, across: number, vertical: boolean): void {
    if (vertical) {
        ctx.moveTo(across, along)
        return
    }
    ctx.moveTo(along, across)
}

/**
 * Line to a point in the band's own axes, mapped to canvas x/y by orientation.
 * @param ctx - canvas context
 * @param along - the pixel on the free axis
 * @param across - the pixel on the paired axis
 * @param vertical - whether the band rides the y axis
 */
function line_to(ctx: RenderContext['ctx'], along: number, across: number, vertical: boolean): void {
    if (vertical) {
        ctx.lineTo(across, along)
        return
    }
    ctx.lineTo(along, across)
}
