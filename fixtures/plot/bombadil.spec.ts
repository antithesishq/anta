import { actions, extract, registerCustomAction, weighted } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForPlotFixture = registerCustomAction(
  'waitForPlotFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (!document.querySelector('[data-fixture="plot"]')) {
      if (Date.now() >= deadline) throw new Error('Plot fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const hoverPlotCenter = registerCustomAction(
  'plotHoverCenter',
  async (document, window) => {
    const target = document.querySelector<HTMLElement>('[data-plot-target]')
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
  async (document, window) => {
    const target = document.querySelector<HTMLElement>('[data-plot-target]')
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
  async (document, window) => {
    const target = document.querySelector<HTMLElement>('[data-plot-target]')
    target?.dispatchEvent(new window.MouseEvent('mouseleave'))
  },
)

const zoomPlotIn = registerCustomAction(
  'plotZoomIn',
  async (document, window) => {
    const capture = document.querySelector<HTMLElement>('[data-plot-target] .plot-capture')
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
  async (document, window) => {
    const capture = document.querySelector<HTMLElement>('[data-plot-target] .plot-capture')
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
  async (document, window) => {
    const target = document.querySelector<HTMLElement>('[data-plot-target]')
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
  async (document) => {
    document.querySelector<HTMLElement>('[data-plot-mount-toggle]')?.click()
  },
)

const fixture = extract((state) => {
  const ready = state.document.querySelector('[data-fixture="plot"]') !== null
  const mounted = state.document.querySelector('[data-plot-target]') !== null
  const capture = state.document.querySelector<HTMLElement>('[data-plot-target] .plot-capture')
  if (!capture) return { canPoint: false, canWheel: false, mounted, ready }

  const bounds = capture.getBoundingClientRect()
  const canPoint = capture.style.display !== 'none' && bounds.width > 0 && bounds.height > 0
  return {
    canPoint,
    canWheel: canPoint && capture.hasAttribute('wheel-capture'),
    mounted,
    ready,
  }
})

const plotGestureActions = actions(() => {
  const current = fixture.current
  if (!current.canPoint) return []

  return [
    hoverPlotCenter(),
    selectPlotCenter(),
    leavePlot(),
    resetPlotWithDoubleClick(),
    ...(current.canWheel ? [zoomPlotIn(), zoomPlotOut()] : []),
  ]
})

const plotMountActions = actions(() => (
  fixture.current.ready && (!fixture.current.mounted || fixture.current.canPoint)
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
