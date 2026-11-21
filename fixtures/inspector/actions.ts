import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Inspector'

const target = extract(state => {
  const record = state.window.__antaInspector
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
  // The Inspector's id lands on its tree; the copy menu follows the tree.
  const host = state.document.getElementById(record.id)
  if (!host) return null
  const menu = host.nextElementSibling as (Element & { isOpen?: boolean }) | null
  const focus = state.document.activeElement
  return {
    focused: focus?.localName === 'a-tree-item' && host.contains(focus),
    actionsFocused: !!focus?.closest('a-tree-actions') && host.contains(focus),
    menuOpen: menu?.localName === 'a-menu' && !!menu.isOpen,
  }
})

// Focus the tree's one Tab stop, as Tab would.
const focusInspector = registerCustomAction('focusInspector', async (document, window) => {
  const host = document.getElementById(window.__antaInspector!.id)!
  host.querySelector<HTMLElement>('a-tree-item[tabindex="0"]')?.focus()
})

const press = (codes: number[]) => codes.map(code => ({ PressKey: { code } }))

// On a row: arrows, Home, End, Enter, Space, and the Menu key. Right on a row
// that can't open, or an open one, moves to its ⋯ button. On the button:
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
