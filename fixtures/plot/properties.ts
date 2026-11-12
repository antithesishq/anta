import { always, eventually, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Plot'

const plot = extract(state => {
  const record = state.window.__antaPlot
  const lateCallback = state.window.__antaPlotLateCallback ?? null
  if (!record) return { current: null, lateCallback }
  const surface = state.document.getElementById(record.id)!.querySelector('a-plot-surface')
  const menu = surface?.querySelector('a-menu') as (HTMLElement & { isOpen: boolean }) | null
  const active = state.document.activeElement
  const capture = surface?.querySelector('a-capture')
  const box = capture?.getBoundingClientRect()
  const surfaceWidth = surface?.getBoundingClientRect().width ?? 0
  const rect = surface?.getBoundingClientRect()
  const visible = !!rect && rect.bottom > 0 && rect.right > 0 && rect.top < state.window.innerHeight && rect.left < state.window.innerWidth
  const presentation = surface?.getAttribute('presentation')
  return {
    current: { ...record, surfaceWidth, visible,
      menuOpen: !!menu?.isOpen,
      menuFocused: !!menu?.contains(active),
      hasEnabledMenuItem: !!menu?.querySelector('[data-zoom-action]:not([disabled])'),
      menuAnchorFocused: !!active?.classList.contains('plot-menu-anchor') && !!surface?.contains(active),
      modalOpen: !!state.document.querySelector('a-dialog[state="open"]'), presentation: presentation ? JSON.parse(presentation) as { width: number; height: number } : null,
      capture: box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, wheel: capture!.getAttribute('wheel-capture') } : null },
    lateCallback,
  }
})

function same(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }
function interrupted(allowClick: string) {
  const action = lastAction.current
  if (!action || typeof action !== 'object') return false
  if ('ScrollUp' in action || 'ScrollDown' in action || 'MouseDrag' in action || 'SetViewport' in action) return true
  if ('Click' in action) {
    const fingerprint = action.Click.fingerprint as typeof action.Click.fingerprint & { text_content: string | null }
    return fingerprint.text_content !== allowClick
  }
  return false
}
function fullView(view: { x: { window: number[]; full: number[] } | null; y: { window: number[]; full: number[] } | null }) {
  return [view.x, view.y].every(axis => !axis || axis.window.every((value, i) => Math.abs(value - axis.full[i]) < 1e-7))
}

export const plotHeightEventuallyMatches = always(() => {
  const before = plot.current.current
  if (!before) return true
  return eventually(() => {
    const after = plot.current.current
    return after?.id !== before.id || after.height !== before.height || after.presentation?.height === before.height
  }).within(3, 'seconds')
})

export const plotWidthEventuallyMatchesSurface = always(() => {
  const before = plot.current.current
  if (!before || !before.visible || before.surfaceWidth <= 0) return true
  return eventually(() => {
    const after = plot.current.current
    return after?.id !== before.id || !after.visible || after.surfaceWidth !== before.surfaceWidth
      || (!!after.presentation && Math.abs(after.presentation.width - before.surfaceWidth) < 1)
  }).within(3, 'seconds')
})

export const plotEnabledZoomChangesViewport = always(() => {
  const before = plot.current.current
  if (!before?.zoomPan || (before.viewport?.zoom_factor.x ?? 1) >= 9999) return true
  return next(() => {
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('Click' in action)) return true
    const fingerprint = action.Click.fingerprint as typeof action.Click.fingerprint & { text_content: string | null }
    if (fingerprint.text_content !== 'Zoom In') return true
    return eventually(() => {
      const after = plot.current.current
      return after?.id !== before.id || !after.zoomPan || after.height !== before.height || interrupted('Zoom In')
        || !same(after.points, before.points) || after.presentation?.width !== before.presentation?.width
        || (!!after.viewport && after.viewport.zoom_factor.x > (before.viewport?.zoom_factor.x ?? 1))
    }).within(3, 'seconds')
  })
})

export const plotDisabledPreservesViewport = always(() => {
  const before = plot.current.current
  if (!before || before.zoomPan) return true
  return next(() => {
    const after = plot.current.current
    if (after?.id !== before.id || after.zoomPan || !same(after.points, before.points)) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('ScrollUp' in action || 'ScrollDown' in action || 'MouseDrag' in action)) return true
    return same(after.viewport, before.viewport)
  })
})

export const plotResetReturnsToFullView = always(() => {
  const before = plot.current.current
  if (!before?.viewport || !before.zoomPan) return true
  return next(() => {
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('Click' in action)) return true
    const fingerprint = action.Click.fingerprint as typeof action.Click.fingerprint & { text_content: string | null }
    if (fingerprint.text_content !== 'Reset Zoom') return true
    return eventually(() => {
      const after = plot.current.current
      return after?.id !== before.id || !after.zoomPan || after.height !== before.height || interrupted('Reset Zoom')
        || !same(after.points, before.points) || (!!after.viewport && fullView(after.viewport) && after.points.every(point =>
          !!after.viewport!.x && !!after.viewport!.y && point.x >= after.viewport!.x.full[0] && point.x <= after.viewport!.x.full[1]
          && point.y >= after.viewport!.y.full[0] && point.y <= after.viewport!.y.full[1]))
    }).within(3, 'seconds')
  })
})

export const plotUnrelatedActionsPreserveViewport = always(() => {
  const before = plot.current.current
  if (!before?.viewport) return true
  return next(() => {
    const after = plot.current.current
    if (after?.id !== before.id || after.zoomPan !== before.zoomPan || after.height !== before.height || !same(after.points, before.points)) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('Custom' in action) || action.Custom.name !== 'advanceAppFixture') return true
    return same(after.viewport, before.viewport)
  })
})

export const plotUnmountStopsCallbacks = always(() =>
  plot.current.lateCallback === null
)

export const plotKeyboardOpensAndDismissesZoomMenu = always(() => {
  const before = plot.current.current
  if (!before?.zoomPan || before.modalOpen) return true
  return next(() => {
    const after = plot.current.current
    const action = lastAction.current
    if (after?.id !== before.id || !action || typeof action !== 'object' || !('PressKey' in action)) return true
    const key = action.PressKey.code
    if (!before.menuOpen && before.menuAnchorFocused && key === 93) {
      return after.menuOpen && (!before.hasEnabledMenuItem || after.menuFocused)
    }
    if (before.menuOpen && before.menuFocused && key === 27) {
      return !after.menuOpen && after.menuAnchorFocused
    }
    return true
  })
})
