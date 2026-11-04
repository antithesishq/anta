import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Tabs'

const target = extract(state => {
  const record = state.window.__antaTabs
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  const strip = state.document.getElementById(record.id)!
  if (strip.hasAttribute('disabled')) return null
  return { focused: strip.contains(state.document.activeElement) }
})

const focusTabs = registerCustomAction('focusTabs', async (document, window) => {
  document.getElementById(window.__antaTabs!.id)!.querySelector<HTMLElement>('a-tab[tabindex="0"]')!.focus()
})

export const tabsKeyboard = actions(() => {
  if (!target.current) return []
  if (!target.current.focused) return [focusTabs()]
  return [37, 39, 36, 35].map(code => ({ PressKey: { code } }))
})
