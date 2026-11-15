import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Expander'

const target = extract(state => {
  const record = state.window.__antaExpander
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  const host = state.document.getElementById(record.id)!
  if (host.hasAttribute('disabled')) return null
  return { focused: state.document.activeElement === host && !!host.shadowRoot!.activeElement }
})

const focusExpander = registerCustomAction('focusExpander', async (document, window) => {
  document.getElementById(window.__antaExpander!.id)!.shadowRoot!.querySelector<HTMLButtonElement>('[part="summary"]')!.focus()
})

export const expanderKeyboard = actions(() => {
  if (!target.current) return []
  if (!target.current.focused) return [focusExpander()]
  return [13, 32].map(code => ({ PressKey: { code } }))
})
