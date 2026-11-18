import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Inspector'

const target = extract(state => {
  const record = state.window.__antaInspector
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  return { focused: state.document.activeElement === state.document.getElementById(record.id) }
})

const focusInspector = registerCustomAction('focusInspector', async (document, window) => {
  document.getElementById(window.__antaInspector!.id)!.focus()
})

// Arrows, Home, End, Enter, and Space: the tree keyboard pattern.
export const inspectorKeyboard = actions(() => {
  if (!target.current) return []
  if (!target.current.focused) return [focusInspector()]
  return [37, 38, 39, 40, 36, 35, 13, 32].map(code => ({ PressKey: { code } }))
})
