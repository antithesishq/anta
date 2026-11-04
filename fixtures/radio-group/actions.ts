import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './RadioGroup'

const target = extract(state => {
  const record = state.window.__antaRadioGroup
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  const group = state.document.getElementById(record.id)!
  if (group.hasAttribute('disabled')) return null
  return { focused: group.contains(state.document.activeElement) }
})

const focusRadio = registerCustomAction('focusRadio', async (document, window) => {
  document.getElementById(window.__antaRadioGroup!.id)!.querySelector<HTMLElement>('a-radio[tabindex="0"]')!.focus()
})

export const radioKeyboard = actions(() => {
  if (!target.current) return []
  if (!target.current.focused) return [focusRadio()]
  return [37, 38, 39, 40, 13, 32].map(code => ({ PressKey: { code } }))
})
