export { new_scatter as scatter, type ScatterArgs } from '../core/series/scatter/factory'
export { new_bar as bar, type BarArgs } from '../core/series/bar/factory'
export { new_rect as rect, type RectArgs } from '../core/series/rect/factory'
export { new_line as line, type LineArgs } from '../core/series/line/factory'
export { new_rule as rule, type RuleArgs } from '../core/series/rule/factory'
export { new_area as area, type AreaArgs } from '../core/series/area/factory'
export { new_custom as custom, type CustomArgs } from '../core/series/custom/factory'
export { PlotController, type PlotEnvironment, type PlotDrawHost, type PlotLifecycleError } from '../core/controller'
export { PlotInteractionController, type PanInput, type PanUpdate } from '../core/interaction_controller'
export type { NearestPoint } from '../core/interactions/hit'
export type { ResolvedTooltip } from '../core/interactions/tooltip'
export type {
    Domain, Viewport, SideMargins, Margin, Stroke,
    ScatterSeries, RectSeries, BarSeries, BarPixelSpan, LineSeries,
    RuleSeries, AreaSeries, AreaPixelRuns, CustomSeries, Series,
    ComposedScatter, ComposedRect, ComposedBar, ComposedLine, ComposedRule,
    ComposedArea, ComposedCustom, ComposedSeries, AxisKind, ColorPair,
    ThemeColor, LabelPosition, TickFormat, LabelArg, TickLabelArg,
    AxisArgs, Axis, AxisTemplateKind, LinearAxisTemplate, LogarithmicAxisTemplate,
    TimeAxisTemplate, CategoryAxisTemplate, AxisTemplate, GridSpec, ZoomPanArg,
    ZoomPan, RequestedViewportWindow, ViewportRequest, PlotTemplate, PlotArgs,
    Layout, ComposedPlot, Scale, NumericalScale, ContinuousScale,
    BandScale, CanvasContext, Rect, PixelRect, RenderContext,
    CustomRenderContext, CustomRendererFn, HitContext, PixelResolver, ColorResolver,
    CustomHitTestFn, HighlightSpec, SideMode, AxisScale, AxisContext,
    ColorTheme, ColorArg, TitleArg, StrokeArg, MarkShape,
    RectAlign, FieldArg, PointData, TooltipData, TooltipFn,
    TooltipArg, SelectFn, AxisViewport, ViewportChange, ViewportChangeFn,
    RowTypedArgs, OptionalRowTypedArgs,
} from '../core/types'
export { resolve_canvas_size, type Dimensions } from '../core/compose/layout'
export { prepare_canvas_context } from '../core/render/canvas'
export { clear_highlights, update_highlight_canvas } from '../core/render/highlight'
export { plot_color_filter, plot_wrapper_size } from '../core/presentation/plot'
export { reset_zoom_presentation } from '../core/presentation/reset_zoom'
export {
    render_tooltip_body, TOOLTIP_DIVIDER_STYLE, TOOLTIP_OPTIONS, tooltip_wrapper_style,
} from '../core/presentation/tooltip'
export { create_anta_host, type AntaHost, type AntaHostAdapter } from '../integrations/anta_host'
