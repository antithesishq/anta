import { actions, extract, getFingerprint, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Plot'

const plot = extract(state => {
  const record = state.window.__antaPlot
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  const root = state.document.getElementById(record.id)!
  const capture = root.querySelector('a-plot-surface a-capture')
  if (!capture) return null
  const rect = capture.getBoundingClientRect()
  const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  if (rect.width <= 0 || rect.height <= 0 || point.x < 0 || point.y < 0 || point.x >= state.window.innerWidth || point.y >= state.window.innerHeight) return null
  const menu = root.querySelector('a-plot-surface a-menu')! as HTMLElement & { isOpen: boolean }
  const items = (menu.isOpen ? Array.from(menu.querySelectorAll<HTMLElement>('[data-zoom-action]')) : []).flatMap(item => {
    if (!item.checkVisibility() || item.hasAttribute('disabled')) return []
    const rect = item.getBoundingClientRect()
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    return point.x >= 0 && point.y >= 0 && point.x < state.window.innerWidth && point.y < state.window.innerHeight
      ? [{ fingerprint: getFingerprint(item), point }] : []
  })
  return { point, enabled: record.zoomPan, items }

})

const settlePlot = registerCustomAction('settlePlot', async () => {
  await new Promise(resolve => setTimeout(resolve, 250))
})

const openPlotMenu = registerCustomAction('openPlotMenu', async (document, window) => {
  const capture = document.getElementById(window.__antaPlot!.id)!.querySelector('a-plot-surface a-capture')!
  const rect = capture.getBoundingClientRect()
  capture.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, button: 2,
    clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
  }))
})

export const plotActions = actions(() => {
  const current = plot.current
  if (!current) return []
  const { point } = current
  if (current.items.length) return current.items.map(item => ({ Click: item }))
  return [
    settlePlot(),
    { ScrollUp: { origin: point, distance: 120 } },
    { ScrollDown: { origin: point, distance: 120 } },
    { MouseDrag: { from: point, to: { x: point.x + 30, y: point.y }, steps: 8, delayMillis: 15 } },
    ...(current.enabled ? [openPlotMenu()] : []),
  ]
})

export const plotViewportSizes = actions(() => [
  { SetViewport: { width: 800, height: 700 } },
  { SetViewport: { width: 1280, height: 900 } },
])
