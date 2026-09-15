import type { ComposedRect, PixelRect, Rect, RectAlign, RenderContext, Scale } from "../../types"
import { inset_band } from "../../render/band"

/**
 * Draw a rect series: each row is a rectangle spanning [x, x2] x [y, y2] in data space, or filling the
 * band on a categorical axis. Per-row color overrides the series default. Clipped to the inner rect.
 * @param series - the rect series
 * @param render - the shared render context (canvas, inner rect, scales, fallback color)
 */
export function draw_rect(series: ComposedRect, render: RenderContext): void {
    const { ctx, inner, x_scale, y_scale, color } = render

    if (series.x.length === 0) {
        return
    }
    ctx.fillStyle = color
    const colors = series.colors
    const stroke = series.stroke
    const has_stroke = stroke !== undefined
    const stroke_width = stroke?.width
    const rect_at = make_rect_resolver(series, x_scale, y_scale, inner)

    if (has_stroke) {
        ctx.strokeStyle = stroke.color

        if (stroke_width !== undefined) {
            ctx.lineWidth = stroke_width
        }
    }

    for (let i = 0; i < series.x.length; i++) {
        const rect = rect_at(i)

        if (rect === null) {
            continue
        }

        if (colors !== undefined) {
            ctx.fillStyle = colors[i] ?? color
        }
        ctx.fillRect(rect.left, rect.top, rect.width, rect.height)

        if (has_stroke) {
            if (stroke_width === undefined) {
                ctx.lineWidth = auto_stroke_width(rect.width, rect.height)
            }
            ctx.strokeRect(rect.left, rect.top, rect.width, rect.height)
        }
    }
}

/**
 * Build a per-row rectangle resolver: combines the x / y span resolvers with the band align and offset
 * into one `(i) => PixelRect | null`. Shared by the rect paint, hit-test, and hover highlight so the rect
 * bounds (band fill / data span / sized, plus align and offset) are computed one way.
 * @param series - the composed rect series
 * @param x_scale - x scale
 * @param y_scale - y scale
 * @param inner - the plot area, which a spanned axis covers edge to edge
 * @returns a resolver mapping a row index to its { left, top, width, height } in canvas pixels, or null
 */
export function make_rect_resolver(series: ComposedRect, x_scale: Scale, y_scale: Scale, inner: Rect): (i: number) => PixelRect | null {
    const align = series.band_align ?? 'center'
    const offset_x = series.offset?.x ?? 0
    const offset_y = series.offset?.y ?? 0
    const inset = series.inset
    const min_size = series.min_size
    const resolve_x = series.span === 'x'
        ? full_span_resolver([inner.left, inner.right])
        : make_span_resolver(x_scale, series.x, series.x2, { size: series.size?.width, align, inset, min_size })
    const resolve_y = series.span === 'y'
        ? full_span_resolver([inner.top, inner.bottom])
        : make_span_resolver(y_scale, series.y, series.y2, { size: series.size?.height, align, inset, min_size })

    return (i) => {
        const x_span = resolve_x(i)

        if (x_span === undefined) {
            return null
        }
        const y_span = resolve_y(i)

        if (y_span === undefined) {
            return null
        }
        // a scale can return the corners in either order (y inverts data to pixels), so normalize. offset
        // shifts both endpoints equally, so only the origin moves; width / height are unchanged
        return {
            left: Math.min(x_span[0], x_span[1]) + offset_x,
            top: Math.min(y_span[0], y_span[1]) + offset_y,
            width: Math.abs(x_span[1] - x_span[0]),
            height: Math.abs(y_span[1] - y_span[0]),
        }
    }
}

// A spanned axis covers the plot area edge to edge, through any axis padding — the scale's range stops short of
// it, so this reads the inner rect instead. Matches how a rule is drawn across the axis it doesn't constrain.
function full_span_resolver(span: [number, number]): (i: number) => [number, number] {
    return () => span
}

const STROKE_AUTO_FRACTION = 0.04
const STROKE_MIN_WIDTH = 0.2
const STROKE_MAX_WIDTH = 1

/**
 * Derive a stroke width from a rect's pixel dimensions, scaling with the smaller side.
 * @param width - the rect's pixel width
 * @param height - the rect's pixel height
 * @returns the clamped stroke width in pixels
 */
function auto_stroke_width(width: number, height: number): number {
    const derived = Math.min(width, height) * STROKE_AUTO_FRACTION
    return Math.max(STROKE_MIN_WIDTH, Math.min(derived, STROKE_MAX_WIDTH))
}

type SpanOptions = {
    size: number | undefined
    align: RectAlign
    inset: number | undefined
    min_size: number | undefined
}

/**
 * Build a per-row pixel-span resolver. Band fills the whole band (unless a size overrides) and returns undefined for unknown categories
 * A pixel size maps the center then spreads it by half the size.
 * @param scale - the axis scale
 * @param lo - the first corner / center / band value per row
 * @param hi - the opposite corner per row, or undefined when not a data span
 * @param options - sizing, band alignment, inset and the data-span floor
 * @returns a resolver mapping row index to a pixel span, or undefined to skip
 */
function make_span_resolver(scale: Scale, lo: Float64Array, hi: Float64Array | undefined, options: SpanOptions): (i: number) => [number, number] | undefined {
    const { size, align, inset, min_size } = options

    if ('bandwidth' in scale) {
        const bandwidth = scale.bandwidth()
        return (i) => {
            const raw_start = scale(lo[i])

            if (raw_start === undefined) {
                return undefined
            }
            const { start, extent } = inset_band(raw_start, bandwidth, inset)

            // a size overrides the band fill, anchored per align, so a highlight rect can exceed the band height
            if (size !== undefined) {
                return align_band_span(start, extent, size, align)
            }
            return [start, start + extent]
        }
    }

    if (size !== undefined) {
        const half = size / 2
        return (i) => {
            const center = scale(lo[i])

            if (!Number.isFinite(center)) {
                return undefined
            }
            return [center - half, center + half]
        }
    }

    if (hi !== undefined) {
        return (i) => {
            const start = scale(lo[i])
            const end = scale(hi[i])
            const finite = Number.isFinite(start) && Number.isFinite(end)

            if (!finite) {
                return undefined
            }

            if (min_size === undefined || Math.abs(end - start) >= min_size) {
                return [start, end]
            }
            const center = (start + end) / 2
            return [center - min_size / 2, center + min_size / 2]
        }
    }

    // unreachable: validate_rect_axis guarantees we won't reach here.
    throw new Error('plot.rect: internal — numeric axis resolved without a corner, size, or band')
}

/**
 * Place a fixed-`size` rect within a band per `align`: centered, or flush to the start / end edge.
 * `band` may be negative (inverted range), so edge offsets follow its sign to stay on the interior side.
 * @param start - the band's scale-start pixel
 * @param band - the signed band width in pixels
 * @param size - the sized dimension in pixels
 * @param align - center (default), or the start / end edge to anchor to
 * @returns the pixel span (either order; the paint normalizes)
 */
function align_band_span(start: number, band: number, size: number, align: RectAlign): [number, number] {
    const dir = Math.sign(band) || 1

    if (align === 'start') {
        return [start, start + dir * size]
    }

    if (align === 'end') {
        const far = start + band
        return [far, far - dir * size]
    }
    const half = size / 2
    const center = start + band / 2
    return [center - half, center + half]
}
