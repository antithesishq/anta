import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Tree'

const target = extract(state => {
  const record = state.window.__antaTree
  if (!record || state.document.querySelector('a-dialog[state="open"]')) return null
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
const focusTree = registerCustomAction('focusTree', async (document, window) => {
  const host = document.getElementById(window.__antaTree!.id)!
  host.querySelector<HTMLElement>('a-tree-item[tabindex="0"]')?.focus()
})

const press = (codes: number[]) => codes.map(code => ({ PressKey: { code } }))

// On an item: arrows, Home, End, Page Up, Page Down, Enter, Space, and the
// Menu key. Right on an open folder or a file reaches the row's actions. On an
// action: Right and Left move between actions, Left on the first and Escape
// return, vertical keys return and move, Enter and Space press it. An open menu
// closes with Escape. PressKey has no modifiers, so the Menu key stands in for
// Shift+F10.
export const treeKeyboard = actions(() => {
  const current = target.current
  if (!current) return []
  if (current.menuOpen) return press([27])
  if (current.actionsFocused) return press([37, 39, 38, 40, 13, 32, 27, 93])
  if (!current.focused) return [focusTree()]
  return press([37, 38, 39, 40, 36, 35, 33, 34, 13, 32, 93])
})
