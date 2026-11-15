import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Slider'

const target = extract(state => {
  const record = state.window.__antaSlider
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  const element = state.document.getElementById(record.id)!
  if (element.hasAttribute('disabled')) return null
  return { focused: state.document.activeElement === element }
})

const focusSlider = registerCustomAction('focusSlider', async (document, window) => {
  document.getElementById(window.__antaSlider!.id)!.focus()
})

export const sliderKeyboard = actions(() => {
  if (!target.current) return []
  if (!target.current.focused) return [focusSlider()]
  return [37, 39, 36, 35].map(code => ({ PressKey: { code } }))
})

const dragTarget = extract(state => {
  const record = state.window.__antaSlider
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  const host = state.document.getElementById(record.id)!
  const thumb = host.shadowRoot!.querySelector('[part~="thumb-1"]')!.getBoundingClientRect()
  const rail = host.shadowRoot!.querySelector('[part~="rail-area"]')!.getBoundingClientRect()
  const from = { x: thumb.left + thumb.width / 2, y: thumb.top + thumb.height / 2 }
  const direction = record.value < (Number(host.getAttribute('min')) + Number(host.getAttribute('max'))) / 2 ? 1 : -1
  const to = { x: from.x + direction * rail.width / 3, y: from.y }
  if (from.x < 0 || from.y < 0 || to.x < 0 || from.x >= state.window.innerWidth || to.x >= state.window.innerWidth || from.y >= state.window.innerHeight) return null
  return { from, to }
})

export const sliderDrag = actions(() => dragTarget.current
  ? [{ MouseDrag: { ...dragTarget.current, steps: 8, delayMillis: 15 } }]
  : [])
