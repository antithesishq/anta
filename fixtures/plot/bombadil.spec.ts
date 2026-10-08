import { actions, extract, registerCustomAction, weighted } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForPlotFixture = registerCustomAction(
  'waitForPlotFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (true) {
      const captures = Array.from(document.querySelectorAll<HTMLElement>('[data-plot-target] .plot-capture'))
      const plotsReady = captures.length === 10 && captures.every((capture) => {
        const bounds = capture.getBoundingClientRect()
        return capture.style.display !== 'none' && bounds.width > 0 && bounds.height > 0
      })
      if (document.querySelector('[data-fixture="plot"]') && plotsReady) return
      if (Date.now() >= deadline) throw new Error('Plot fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const hoverPlotCenter = registerCustomAction(
  'plotHoverCenter',
  async (document, window, plotIndex: number) => {
    const target = document.querySelectorAll<HTMLElement>('[data-plot-target]')[plotIndex]
    const capture = target?.querySelector<HTMLElement>('.plot-capture')
    if (!target || !capture) return

    const bounds = capture.getBoundingClientRect()
    target.dispatchEvent(new window.MouseEvent('mousemove', {
      bubbles: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    }))
  },
)

const selectPlotCenter = registerCustomAction(
  'plotSelectCenter',
  async (document, window, plotIndex: number) => {
    const target = document.querySelectorAll<HTMLElement>('[data-plot-target]')[plotIndex]
    const capture = target?.querySelector<HTMLElement>('.plot-capture')
    if (!target || !capture) return

    const bounds = capture.getBoundingClientRect()
    target.dispatchEvent(new window.MouseEvent('click', {
      bubbles: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    }))
  },
)

const leavePlot = registerCustomAction(
  'plotLeave',
  async (document, window, plotIndex: number) => {
    const target = document.querySelectorAll<HTMLElement>('[data-plot-target]')[plotIndex]
    target?.dispatchEvent(new window.MouseEvent('mouseleave'))
  },
)

const zoomPlotIn = registerCustomAction(
  'plotZoomIn',
  async (document, window, plotIndex: number) => {
    const target = document.querySelectorAll<HTMLElement>('[data-plot-target]')[plotIndex]
    const capture = target?.querySelector<HTMLElement>('.plot-capture')
    if (!capture?.hasAttribute('wheel-capture')) return

    const bounds = capture.getBoundingClientRect()
    capture.dispatchEvent(new window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
      deltaY: -120,
    }))
  },
)

const zoomPlotOut = registerCustomAction(
  'plotZoomOut',
  async (document, window, plotIndex: number) => {
    const target = document.querySelectorAll<HTMLElement>('[data-plot-target]')[plotIndex]
    const capture = target?.querySelector<HTMLElement>('.plot-capture')
    if (!capture?.hasAttribute('wheel-capture')) return

    const bounds = capture.getBoundingClientRect()
    capture.dispatchEvent(new window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
      deltaY: 120,
    }))
  },
)

const resetPlotWithDoubleClick = registerCustomAction(
  'plotDoubleClickReset',
  async (document, window, plotIndex: number) => {
    const target = document.querySelectorAll<HTMLElement>('[data-plot-target]')[plotIndex]
    const capture = target?.querySelector<HTMLElement>('.plot-capture')
    if (!target || !capture) return

    const bounds = capture.getBoundingClientRect()
    target.dispatchEvent(new window.MouseEvent('dblclick', {
      bubbles: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    }))
  },
)

const togglePlotMount = registerCustomAction(
  'plotToggleMount',
  async (document, window) => {
    const wasMounted = document.querySelector('[data-plot-target]') !== null
    document.querySelector<HTMLElement>('[data-plot-mount-toggle]')?.click()
    if (wasMounted) return

    const deadline = Date.now() + 5_000
    while (true) {
      const captures = Array.from(document.querySelectorAll<HTMLElement>('[data-plot-target] .plot-capture'))
      const plotsReady = captures.length === 10 && captures.every((capture) => {
        const bounds = capture.getBoundingClientRect()
        return capture.style.display !== 'none' && bounds.width > 0 && bounds.height > 0
      })
      if (plotsReady) return
      if (Date.now() >= deadline) throw new Error('Plot fixture did not remount within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const fixture = extract((state) => {
  const ready = state.document.querySelector('[data-fixture="plot"]') !== null
  const plots = Array.from(state.document.querySelectorAll<HTMLElement>('[data-plot-target]'), (target) => {
    const capture = target.querySelector<HTMLElement>('.plot-capture')
    if (!capture) return { canPoint: false, canWheel: false }

    const bounds = capture.getBoundingClientRect()
    const canPoint = capture.style.display !== 'none' && bounds.width > 0 && bounds.height > 0
    return {
      canPoint,
      canWheel: canPoint && capture.hasAttribute('wheel-capture'),
    }
  })

  return {
    mounted: plots.length > 0,
    plots,
    ready,
  }
})

const plotGestureActions = actions(() => {
  const current = fixture.current
  return current.plots.flatMap((plot, plotIndex) => (
    plot.canPoint
      ? [
          hoverPlotCenter(plotIndex),
          selectPlotCenter(plotIndex),
          leavePlot(plotIndex),
          resetPlotWithDoubleClick(plotIndex),
          ...(plot.canWheel ? [zoomPlotIn(plotIndex), zoomPlotOut(plotIndex)] : []),
        ]
      : []
  ))
})

const plotMountActions = actions(() => (
  fixture.current.ready && (
    !fixture.current.mounted
    || fixture.current.plots.length === 10 && fixture.current.plots.every((plot) => plot.canPoint)
  )
    ? [togglePlotMount()]
    : []
))

export const plotActions = weighted([
  [100, plotGestureActions],
  [1, plotMountActions],
])

export const plotReadyActions = actions(() => (
  fixture.current.ready ? [] : [waitForPlotFixture()]
))
