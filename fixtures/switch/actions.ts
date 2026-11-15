import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Switch'

const target = extract(state => {
  const record = state.window.__antaSwitch
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  if (state.document.activeElement?.id === record.id) return { focused: true }
  return record.requestedDisabled ? null : { focused: false }
})

const focusSwitch = registerCustomAction('focusSwitch', async (document, window) => {
  document.getElementById(window.__antaSwitch!.id)!.focus()
})

export const switchKeyboard = actions(() => {
  if (!target.current) return []
  if (!target.current.focused) return [focusSwitch()]
  return [32].map(code => ({ PressKey: { code } }))
})
