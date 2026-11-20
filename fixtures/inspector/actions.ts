import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Inspector'

const target = extract(state => {
  const record = state.window.__antaInspector
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  const host = state.document.getElementById(record.id)
  if (!host) return null
  // The wrapper renders its copy menu right after the tree.
  const menu = host.nextElementSibling as (Element & { isOpen?: boolean }) | null
  const focus = state.document.activeElement
  return {
    focused: focus === host,
    actionsFocused: focus?.localName === 'a-inspector-actions' && host.contains(focus),
    menuOpen: menu?.localName === 'a-menu' && !!menu.isOpen,
  }
})

const focusInspector = registerCustomAction('focusInspector', async (document, window) => {
  document.getElementById(window.__antaInspector!.id)!.focus()
})

const press = (codes: number[]) => codes.map(code => ({ PressKey: { code } }))

// On the tree: arrows, Home, End, Enter, Space, and the Menu key. Right on a
// row that can't open, or an open one, moves to its ⋯ button. On the button:
// Enter, Space, and the Menu key open the copy menu; Left and Escape return;
// vertical keys return and move. An open menu closes with Escape. PressKey has
// no modifiers, so the Menu key stands in for Shift+F10.
export const inspectorKeyboard = actions(() => {
  const current = target.current
  if (!current) return []
  if (current.menuOpen) return press([27])
  if (current.actionsFocused) return press([37, 38, 39, 40, 36, 35, 13, 32, 27, 93])
  if (!current.focused) return [focusInspector()]
  return press([37, 38, 39, 40, 36, 35, 13, 32, 93])
})
