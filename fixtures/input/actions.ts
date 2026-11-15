import { actions, extract, registerCustomAction, weighted } from '@antithesishq/bombadil/browser'
import type {} from './Input'

const target = extract(state => {
  const record = state.window.__antaInput
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  const host = state.document.getElementById(record.id)!
  const control = host.shadowRoot!.querySelector('input')!
  if (control.disabled) return null
  return { focused: host.shadowRoot!.activeElement === control }
})

const focusInput = registerCustomAction('focusInput', async (document, window) => {
  document.getElementById(window.__antaInput!.id)!.focus()
})

const edits = weighted([
  [3, actions(() => [{ TypeText: { text: { Regexp: '[a-z0-9]{1,6}' } } }])],
  [1, actions(() => [8, 46, 37, 39, 36, 35].map(code => ({ PressKey: { code } })))],
])

export const inputEditing = actions(() => {
  if (!target.current) return []
  return target.current.focused ? edits.generate() : [focusInput()]
})
