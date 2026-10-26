/** Magnification accumulated by viewport gestures; data updates and panning preserve it. */
export type ViewportZoom = Readonly<{ x: number; y: number }>
export const UNIT_ZOOM: ViewportZoom = Object.freeze({ x: 1, y: 1 })
