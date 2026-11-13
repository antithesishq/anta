import { actions, extract, getFingerprint, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Select'

const options = extract(state => {
  const record = state.window.__antaSelect
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return []
  const menu = state.document.getElementById(record.id)!.querySelector('a-menu')! as HTMLElement & { isOpen: boolean }
  if (!menu.isOpen) return []
  return Array.from(menu.querySelectorAll('[data-testid]')).flatMap(option => {
    const rect = option.getBoundingClientRect()
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    return option.checkVisibility() && point.x >= 0 && point.x < state.window.innerWidth
      && point.y >= 0 && point.y < state.window.innerHeight
      ? [{ fingerprint: getFingerprint(option), point }] : []
  })
})

export const selectOptions = actions(() => options.current.map(option => ({ Click: option })))

const keyboardTarget = extract(state => {
  const record = state.window.__antaSelect
  if (!record || record.requestedDisabled || state.document.querySelector('a-dialog[state="open"]')) return null
  const root = state.document.getElementById(record.id)!
  const trigger = root.querySelector('a-input')!
  const menu = root.querySelector('a-menu')! as HTMLElement & { isOpen: boolean }
  return {
    open: menu.isOpen,
    triggerFocused: state.document.activeElement === trigger,
    optionFocused: menu.contains(state.document.activeElement) && state.document.activeElement!.hasAttribute('data-testid'),
  }
})

const focusSelect = registerCustomAction('focusSelect', async (document, window) => {
  document.getElementById(window.__antaSelect!.id)!
    .querySelector('a-input')!.shadowRoot!.querySelector('button')!.focus()
})

export const selectKeyboard = actions(() => {
  const current = keyboardTarget.current
  if (!current) return []
  if (current.open) {
    return (current.optionFocused ? [36, 13, 27] : [36, 27]).map(code => ({ PressKey: { code } }))
  }
  return current.triggerFocused ? [{ PressKey: { code: 40 } }] : [focusSelect()]
})
