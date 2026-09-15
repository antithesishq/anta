/**
 * Transitional core type surface. Callback types here are ordinary JavaScript functions.
 * The production notebook API remains in ui/plotting/types.ts and continues to require
 * engine PureFunction values for serialization and equality hashing.
 *
 * Tooltip content is host-supplied so this surface has no framework dependency.
 */
import type { ScaleBand, ScaleLinear, ScaleLogarithmic, ScaleTime } from "d3-scale"

export type Domain = [number, number]
export type Viewport = { x: Domain | null; y: Domain | null }

// margin is the space between the plot area and the canvas edge, per side. Chrome (tick
// labels, axis names, title) paints inside this band. A number applies to all four sides.
export type SideMargins = {
    top?: number
    right?: number
    bottom?: number
    left?: number
}

export type Margin = number | SideMargins

type SeriesTypes = 'scatter' | 'rect' | 'bar' | 'line' | 'rule' | 'area' | 'custom'

type BaseSeries<TooltipContent = unknown> = {
    kind: SeriesTypes
    x: Float64Array
    y: Float64Array
    color?: ThemeColor
    colors?: (ThemeColor | null)[]
    tooltip?: TooltipArg<any, TooltipContent>
    on_select?: SelectFn<any>
    hoverable?: boolean
    highlight?: boolean
    rows?: Record<string, unknown>[]
    labels?: string[]
    x_axis_kind?: AxisKind
    y_axis_kind?: AxisKind
    x_categories?: string[]
    y_categories?: string[]
    x_field?: string
    y_field?: string
}

export type Stroke = { color: ThemeColor; width?: number }

export type ScatterSeries<TooltipContent = unknown> = BaseSeries<TooltipContent> & {
    kind: 'scatter'
    size?: number
    sizes?: (number | null)[]
    mark?: MarkShape
    stroke?: Stroke
}

export type RectSeries<TooltipContent = unknown> = BaseSeries<TooltipContent> & {
    kind: 'rect'
    span?: 'x' | 'y'
    x2?: Float64Array
    y2?: Float64Array
    size?: { width?: number; height?: number }
    band_align?: RectAlign
    hover_span_x?: boolean
    hover_span_y?: boolean
    offset?: { x?: number; y?: number }
    inset?: number
    min_size?: number
    stroke?: Stroke
}

export type BarSeries<TooltipContent = unknown> = BaseSeries<TooltipContent> & {
    kind: 'bar'
    border_radius?: number
    inset?: number
    min_size?: number
    hover_span_x?: boolean
    hover_span_y?: boolean
    stack_base?: Float64Array
    is_tip?: Uint8Array
}

// where each bar (segment) starts and ends on the value axis, in pixels
export type BarPixelSpan = { baseline: Float64Array; tip: Float64Array }

export type LineSeries<TooltipContent = unknown> = BaseSeries<TooltipContent> & {
    kind: 'line'
    width?: number
    dash?: number[]
    mark?: MarkShape
    mark_size?: number
    stroke?: Stroke
}

export type RuleSeries<TooltipContent = unknown> = BaseSeries<TooltipContent> & {
    kind: 'rule'
    side: 'x' | 'y'
    width?: number
    dash?: number[]
}

export type AreaSeries<TooltipContent = unknown> = BaseSeries<TooltipContent> & {
    kind: 'area'
    x2?: Float64Array
    y2?: Float64Array
    bound_pinned?: boolean
    dash?: number[]
    stroke?: Stroke
}

export type AreaPixelRuns = {
    along: Float64Array
    edge: Float64Array
    base: Float64Array
    row: Int32Array
    run_starts: Int32Array
}

export type CustomSeries<TooltipContent = unknown> = BaseSeries<TooltipContent> & {
    kind: 'custom'
    renderer: CustomRendererFn<TooltipContent>
    hit_test?: CustomHitTestFn<TooltipContent>
    axis_range?: { x?: Domain; y?: Domain }
}

export type Series<TooltipContent = unknown> =
    | ScatterSeries<TooltipContent>
    | RectSeries<TooltipContent>
    | BarSeries<TooltipContent>
    | LineSeries<TooltipContent>
    | RuleSeries<TooltipContent>
    | AreaSeries<TooltipContent>
    | CustomSeries<TooltipContent>

// color fields after compose resolves each ThemeColor to a concrete string for the current theme
type ResolvedColorFields = {
    color?: string
    colors?: (string | null)[]
    stroke?: { color: string; width?: number }
}

// T, but with R's keys overridden
type ReplaceKeys<T, R> = Omit<T, keyof R> & R

// each series with its color fields resolved to plain strings — compose's output, what the paints read
export type ComposedScatter<TooltipContent = unknown> = ReplaceKeys<ScatterSeries<TooltipContent>, ResolvedColorFields>
export type ComposedRect<TooltipContent = unknown> = ReplaceKeys<RectSeries<TooltipContent>, ResolvedColorFields>
export type ComposedBar<TooltipContent = unknown> = ReplaceKeys<BarSeries<TooltipContent>, ResolvedColorFields & { value_span?: BarPixelSpan }>
export type ComposedLine<TooltipContent = unknown> = ReplaceKeys<LineSeries<TooltipContent>, ResolvedColorFields>
export type ComposedRule<TooltipContent = unknown> = ReplaceKeys<RuleSeries<TooltipContent>, ResolvedColorFields>
export type ComposedArea<TooltipContent = unknown> = ReplaceKeys<AreaSeries<TooltipContent>, ResolvedColorFields & { pixel_runs?: AreaPixelRuns }>
export type ComposedCustom<TooltipContent = unknown> = ReplaceKeys<CustomSeries<TooltipContent>, ResolvedColorFields>
export type ComposedSeries<TooltipContent = unknown> =
    | ComposedScatter<TooltipContent>
    | ComposedRect<TooltipContent>
    | ComposedBar<TooltipContent>
    | ComposedLine<TooltipContent>
    | ComposedRule<TooltipContent>
    | ComposedArea<TooltipContent>
    | ComposedCustom<TooltipContent>

export type AxisKind = 'numeric' | 'categorical'

export type ColorPair = { light: string; dark: string }
export type ThemeColor = string | ColorPair

export type LabelPosition = 'center' | 'top' | 'bottom' | 'left' | 'right'
export type TickFormat = (value: number | string, index: number) => string

export type LabelArg = string | {
    text: string
    size?: number
    color?: ThemeColor
    position?: LabelPosition
}

export type TickLabelArg = {
    format?: TickFormat
    size?: number
    color?: ThemeColor
}

export type AxisArgs = {
    scale?: AxisScale
    label?: LabelArg
    min?: number
    max?: number
    categories?: string[]
    padding?: number
    padding_top?: number
    padding_bottom?: number
    padding_left?: number
    padding_right?: number
    grid_align?: 'center' | 'edge'
    line?: boolean
    hidden?: boolean
    tick_label?: TickLabelArg
    tick_mark?: boolean
}

export type Axis = {
    scale?: AxisScale
    label?: string
    label_size?: number
    label_color?: ThemeColor
    label_position?: LabelPosition
    min?: number
    max?: number
    categories?: string[]
    padding?: number
    padding_top?: number
    padding_bottom?: number
    padding_left?: number
    padding_right?: number
    grid_align?: 'center' | 'edge'
    line?: boolean
    hidden?: boolean
    tick_label_format?: TickFormat
    tick_label_size?: number
    tick_label_color?: ThemeColor
    tick_mark?: boolean
}

export type AxisTemplateKind = 'linear' | 'log' | 'category' | 'time'

type BaseAxisTemplate = {
    kind: AxisTemplateKind
    rendered: boolean
    axis?: Axis
}

// linear / log / time: a numeric domain with per-end nicing and pixel padding
type ContinuousAxisTemplate = BaseAxisTemplate & {
    domain: Domain
    nice_min: boolean
    nice_max: boolean
    padding_min: number
    padding_max: number
}

export type LinearAxisTemplate = ContinuousAxisTemplate & {
    kind: 'linear'
}

export type LogarithmicAxisTemplate = ContinuousAxisTemplate & {
    kind: 'log'
}

export type TimeAxisTemplate = ContinuousAxisTemplate & {
    kind: 'time'
    utc: boolean
}

export type CategoryAxisTemplate = BaseAxisTemplate & {
    kind: 'category'
    categories: string[]
    padding_min: number
    padding_max: number
}

export type AxisTemplate = LinearAxisTemplate | LogarithmicAxisTemplate | CategoryAxisTemplate | TimeAxisTemplate

export type GridSpec = boolean | { x?: boolean; y?: boolean }
export type ZoomPanArg = boolean | { modifier?: boolean; x?: boolean; y?: boolean }

export type ZoomPan = { enabled: boolean; modifier: boolean; x: boolean; y: boolean }

export type RequestedViewportWindow = { x?: Domain | null; y?: Domain | null }

export type ViewportRequest = { window: RequestedViewportWindow; key: string | number | undefined }

export type PlotTemplate<TooltipContent = unknown> = {
    series: Series<TooltipContent>[]
    x: AxisTemplate
    y: AxisTemplate
    title?: string
    title_size?: number
    title_color?: ThemeColor
    margin?: Margin
    width?: number
    height?: number
    border?: boolean
    grid?: GridSpec
    chrome_color?: ThemeColor
    background?: boolean | ThemeColor
    theme_invert?: boolean
    zoom_pan: ZoomPan
    viewport?: ViewportRequest
    on_viewport_change?: ViewportChangeFn
}

// args to plot(): the series plus optional axis / size / style. new_plot_template resolves it into a PlotTemplate.
export type PlotArgs<TooltipContent = unknown> = {
    series: Series<TooltipContent>[]
    axis?: { x?: AxisArgs; y?: AxisArgs }
    title?: TitleArg
    width?: number
    height?: number
    margin?: Margin
    border?: boolean
    grid?: GridSpec
    chrome_color?: ThemeColor
    background?: boolean | ThemeColor
    theme_invert?: boolean
    zoom_pan?: ZoomPanArg
    viewport?: { x?: number[] | null; y?: number[] | null; key?: string | number }
    on_viewport_change?: ViewportChangeFn
}

// canvas dimensions and resolved per-side margins. Produced by core/compose/layout.ts at compose time.
export type Layout = {
    width: number
    height: number
    margin_top: number
    margin_right: number
    margin_bottom: number
    margin_left: number
}

export type ComposedPlot<TooltipContent = unknown> = {
    layout: Layout
    inner: Rect
    x_scale: Scale
    y_scale: Scale
    // full (unzoomed) continuous domain per axis, for zoom/pan reset & clamping; null on a categorical axis
    x_full_domain: Domain | null
    y_full_domain: Domain | null
    x_axis?: Axis
    y_axis?: Axis
    x_categories?: string[]
    y_categories?: string[]
    title?: string
    title_size?: number
    title_color?: ThemeColor
    series: ComposedSeries<TooltipContent>[]
    border?: boolean
    grid?: GridSpec
    background?: string | false
    chrome_theme: ColorTheme
    chrome_color?: string // resolved stroke color for border / grid / axis lines / tick marks
}

export type Scale = ScaleLinear<number, number> | ScaleLogarithmic<number, number> | ScaleBand<number> | ScaleTime<number, number>
export type NumericalScale = ScaleLinear<number, number> | ScaleLogarithmic<number, number>
export type ContinuousScale = ScaleLinear<number, number> | ScaleLogarithmic<number, number> | ScaleTime<number, number>
export type BandScale = ScaleBand<number>

// same paint code runs on main-thread 2D and Worker-thread OffscreenCanvas contexts
export type CanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

// pixel rect for the inner plot area and clip rects
export type Rect = {
    left: number
    right: number
    top: number
    bottom: number
}

export type PixelRect = {
    left: number
    top: number
    width: number
    height: number
}

// the render environment a series paints into: canvas, inner rect, both scales, the resolved fallback color, and each band axis' category labels
export type RenderContext = {
    ctx: CanvasContext
    inner: Rect
    x_scale: Scale
    y_scale: Scale
    color: string
    x_categories?: string[]
    y_categories?: string[]
}

export type CustomRenderContext = RenderContext & {
    resolve_x: PixelResolver
    resolve_y: PixelResolver
    color_at: ColorResolver
}

export type CustomRendererFn<TooltipContent = unknown> = (series: ComposedCustom<TooltipContent>, render_props: CustomRenderContext) => void

export type HitContext = {
    cursor: { x: number; y: number }
    inner: Rect
    x_scale: Scale
    y_scale: Scale
    resolve_x: PixelResolver
    resolve_y: PixelResolver
}

export type PixelResolver = (i: number) => number | undefined

export type ColorResolver = (i: number) => string

export type CustomHitTestFn<TooltipContent = unknown> = (series: ComposedCustom<TooltipContent>, hit: HitContext) => number | null

export type HighlightSpec =
    | { shape: 'mark'; mark: MarkShape; cx: number; cy: number; r: number; color: string }
    | { shape: 'rect'; x: number; y: number; width: number; height: number; color: string; border_radius?: string }

// per-side domain padding mode, set by series padding_mode hooks and consumed by core/template/domain.ts:
//   default         5% symmetric additive pad so .nice() has room to round
//   anchor_zero     bar height on a declared axis, includes zero on the data side
//   spark_symmetric bar height on an undeclared axis, includes zero on both sides
//   log             pass through [min, max], scaleLog().nice() rounds to powers of 10
export type SideMode = 'default' | 'anchor_zero' | 'spark_symmetric' | 'log'


// resolved scale kind for an axis after inference. 'time' is local, 'utc' is UTC; both render via the continuous path.
export type AxisScale = 'linear' | 'log' | 'category' | 'time' | 'utc'

// one side's resolved axis facts, built per side (x and y) by validate_and_build_axis_context: kind,
// whether it paints, the derived label, the resolved scale, and the domain padding mode. Also the
// contract the series-kind hooks read (validate_axes / padding_mode receive both sides).
export type AxisContext = {
    is_category: boolean
    rendered: boolean
    field_label?: string
    scale: AxisScale
    padding_mode: SideMode
    args: Axis
}

export interface SeriesType<TooltipContent = unknown, S extends Series<TooltipContent> = Series<TooltipContent>> {
    kind: S['kind']
    // build the series from validated user args (runs at user-call time)
    factory(args: any): S
    // draw the series to the canvas (runs at render time).
    // series is the composed (string-color) form for this kind; the concrete paint narrows it
    paint(series: ComposedSeries<TooltipContent>, render: RenderContext): void
    // the point index under the cursor, or null. Each kind defines its own hit region
    // inner is the plot area the paint draws into, for kinds whose geometry spans it (rect's `span`)
    tooltip_hit_test(series: ComposedSeries<TooltipContent>, cursor: { x: number; y: number }, x_scale: Scale, y_scale: Scale, inner: Rect): number | null
    // optional: hover-select halo geometry for a point. Consumed by the DOM overlay, not the canvas.
    highlight_spec?(series: ComposedSeries<TooltipContent>, point_index: number, x_scale: Scale, y_scale: Scale, inner: Rect): HighlightSpec | HighlightSpec[] | null
    // optional: precompute pixel geometry that depends on the scales, once per compose, for the paint /
    // hit-test / highlight to share rather than each deriving it (bar places its stacked segments here)
    compose_layout?(series: ComposedSeries<TooltipContent>, x_scale: Scale, y_scale: Scale): ComposedSeries<TooltipContent>
    // optional: throw if this kind's axis requirements aren't met (e.g. bar needs one band axis)
    validate_axes?(x: AxisContext, y: AxisContext, series: S, index: number): void
    // optional: override the default domain padding for this kind (e.g. bar anchors at zero)
    padding_mode?(x: AxisContext, y: AxisContext): { x?: SideMode, y?: SideMode }
    // the [min, max] this series spans per axis, for domain computation. Most series use xy_extent (scan
    // x / y); rect widens x by x2. compute_domains merges these and pads, knowing nothing series-specific.
    domain_extent(series: S): { x: [number, number]; y: [number, number] }
}

// the browser color scheme a plot resolves theme colors against (resolved UI-side at compose time)
export type ColorTheme = 'light' | 'dark'

export type ColorArg = ThemeColor | ((row: Record<string, unknown>, index: number) => ThemeColor)
export type TitleArg = string | { text: string; size?: number; color?: ThemeColor }

export type StrokeArg = ThemeColor | Stroke

// defaults to circle
export type MarkShape = 'circle' | 'square' | 'diamond' | 'triangle'

export type RectAlign = 'center' | 'start' | 'end'

export type FieldArg = string | ((row: Record<string, unknown>, index: number) => number | string)

// the resolved x / y values, plus the original data row, under the cursor, handed to a caller's tooltip
// callback. `label` names the hovered mark when its series has per-mark names — a stacked bar's segment field
export type PointData = {
    x: number | string
    y: number | string
    row?: Record<string, unknown>
    label?: string
}

export type TooltipData<Row = Record<string, unknown>> = Omit<PointData, 'row'> & { row: Row }

export type TooltipFn<Row = Record<string, unknown>, TooltipContent = unknown> = (data: TooltipData<Row>) => TooltipContent

// per-series tooltip: `true` for the default axis-value body, or a callback for a custom one. Default is no tooltip
export type TooltipArg<Row = Record<string, unknown>, TooltipContent = unknown> = true | TooltipFn<Row, TooltipContent>

export type SelectFn<Row = Record<string, unknown>> = (data: TooltipData<Row>) => unknown

export type AxisViewport = { window: number[]; full: number[] }

export type ViewportChange = {
    x: AxisViewport | null
    y: AxisViewport | null
}

export type ViewportChangeFn = (change: ViewportChange) => void

export type RowTypedArgs<SchemaArgs extends object, RowT extends object, TooltipContent = unknown> = Omit<SchemaArgs, 'data' | 'tooltip' | 'on_select'> & {
    data: RowT[]
    tooltip?: TooltipArg<RowT, TooltipContent>
    on_select?: SelectFn<RowT>
}

/** The same as RowTypedArgs, for a kind whose `data` is optional (plot.rule) */
export type OptionalRowTypedArgs<SchemaArgs extends object, RowT extends object, TooltipContent = unknown> = Omit<SchemaArgs, 'data' | 'tooltip' | 'on_select'> & {
    data?: RowT[]
    tooltip?: TooltipArg<RowT | undefined, TooltipContent>
    on_select?: SelectFn<RowT | undefined>
}
