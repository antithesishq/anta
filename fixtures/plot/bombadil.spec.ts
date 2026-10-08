import { actions, extract, getFingerprint, registerCustomAction, weighted } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const PLOT_COUNT = 10
const interactionPoints = [
  [0.15, 0.2],
  [0.5, 0.2],
  [0.85, 0.2],
  [0.2, 0.5],
  [0.5, 0.5],
  [0.8, 0.5],
  [0.15, 0.8],
  [0.5, 0.8],
  [0.85, 0.8],
] as const

const waitForPlotFixture = registerCustomAction(
  'waitForPlotFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (true) {
      const captures = Array.from(document.querySelectorAll<HTMLElement>('[data-plot-target] .plot-capture'))
      const plotsReady = captures.length === PLOT_COUNT && captures.every((capture) => {
        const bounds = capture.getBoundingClientRect()
        return capture.style.display !== 'none' && bounds.width > 0 && bounds.height > 0
      })
      if (document.querySelector('[data-fixture="plot"]') && plotsReady) return
      if (Date.now() >= deadline) throw new Error('Plot fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const hoverPlot = registerCustomAction(
  'plotHover',
  async (document, window, plotIndex: number, xRatio: number, yRatio: number) => {
    const target = document.querySelectorAll<HTMLElement>('[data-plot-target]')[plotIndex]
    const capture = target?.querySelector<HTMLElement>('.plot-capture')
    if (!target || !capture) return

    const bounds = capture.getBoundingClientRect()
    target.dispatchEvent(new window.MouseEvent('mousemove', {
      bubbles: true,
      clientX: bounds.left + bounds.width * xRatio,
      clientY: bounds.top + bounds.height * yRatio,
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

const zoomPlot = registerCustomAction(
  'plotZoom',
  async (document, window, plotIndex: number, xRatio: number, yRatio: number, deltaY: number) => {
    const target = document.querySelectorAll<HTMLElement>('[data-plot-target]')[plotIndex]
    const capture = target?.querySelector<HTMLElement>('.plot-capture')
    if (!capture?.hasAttribute('wheel-capture')) return

    const bounds = capture.getBoundingClientRect()
    capture.dispatchEvent(new window.WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      clientX: bounds.left + bounds.width * xRatio,
      clientY: bounds.top + bounds.height * yRatio,
      deltaY,
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
      const plotsReady = captures.length === PLOT_COUNT && captures.every((capture) => {
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
    if (!capture) return { canPoint: false, canWheel: false, fingerprint: null, point: null }

    const bounds = capture.getBoundingClientRect()
    const canPoint = capture.style.display !== 'none' && bounds.width > 0 && bounds.height > 0
    return {
      canPoint,
      canWheel: canPoint && capture.hasAttribute('wheel-capture'),
      fingerprint: canPoint ? getFingerprint(capture) : null,
      point: canPoint ? {
        x: [bounds.left + 1, bounds.right - 1] as [number, number],
        y: [bounds.top + 1, bounds.bottom - 1] as [number, number],
      } : null,
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
  return current.plots.flatMap((plot, plotIndex) => {
    if (!plot.canPoint || !plot.fingerprint || !plot.point) return []

    return [
      { Click: { fingerprint: plot.fingerprint, point: plot.point } },
      { DoubleClick: { fingerprint: plot.fingerprint, point: plot.point } },
      leavePlot(plotIndex),
      ...interactionPoints.flatMap(([xRatio, yRatio]) => [
        hoverPlot(plotIndex, xRatio, yRatio),
        ...(plot.canWheel ? [
          zoomPlot(plotIndex, xRatio, yRatio, -120),
          zoomPlot(plotIndex, xRatio, yRatio, 120),
        ] : []),
      ]),
    ]
  })
})

const plotMountActions = actions(() => (
  fixture.current.ready && (
    !fixture.current.mounted
    || fixture.current.plots.length === PLOT_COUNT && fixture.current.plots.every((plot) => plot.canPoint)
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
