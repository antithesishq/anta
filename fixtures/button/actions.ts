import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Button'

const target = extract(state => {
  const record = state.window.__antaButton
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  if (state.document.activeElement?.id === record.id) return { focused: true }
  return record.requestedDisabled || record.requestedLoading ? null : { focused: false }
})

const focusButton = registerCustomAction('focusButton', async (document, window) => {
  document.getElementById(window.__antaButton!.id)!.focus()
})

export const buttonKeyboard = actions(() => {
  if (!target.current) return []
  if (!target.current.focused) return [focusButton()]
  return [13, 32].map(code => ({ PressKey: { code } }))
})
