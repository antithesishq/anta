import type { Rect } from '../types'
import type { PointerOffset } from './hit'

export type InteractionTarget = 'plot' | 'x-axis' | 'y-axis' | null
export type WheelInput = PointerOffset & {
    deltaX: number
    deltaY: number
    ctrlKey: boolean
    target: InteractionTarget
}
export type InteractionRegions = { plot: Rect; x: Rect | null; y: Rect | null }
export type AxisHitExtents = { x: number | null; y: number | null }

/** Regions use canvas CSS pixels; axis strips stop at the axis endpoints. */
export function interaction_regions(inner: Rect, extents: AxisHitExtents): InteractionRegions {
    return {
        plot: inner,
        x: extents.x === null ? null : {
            left: inner.left, right: inner.right, top: inner.bottom,
            bottom: inner.bottom + Math.max(20, extents.x),
        },
        y: extents.y === null ? null : {
            left: inner.left - Math.max(20, extents.y), right: inner.left,
            top: inner.top, bottom: inner.bottom,
        },
    }
}

/** Input offsets are relative to the inner plot, including negative margin offsets. */
export function interaction_target(regions: InteractionRegions | null, input: PointerOffset): InteractionTarget {
    if (regions === null) return null
    const x = input.offsetX + regions.plot.left
    const y = input.offsetY + regions.plot.top
    const contains = (rect: Rect | null) => rect !== null
        && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    // The shared axis endpoint belongs to the plot; margin strips have no shared area.
    if (contains(regions.plot)) return 'plot'
    if (contains(regions.x)) return 'x-axis'
    if (contains(regions.y)) return 'y-axis'
    return null
}

/** Restrict a gesture to its starting region and the caller's enabled axes. */
export function target_axes(target: InteractionTarget, axes: { x: boolean; y: boolean }): { x: boolean; y: boolean } {
    return {
        x: axes.x && (target === 'plot' || target === 'x-axis'),
        y: axes.y && (target === 'plot' || target === 'y-axis'),
    }
}
