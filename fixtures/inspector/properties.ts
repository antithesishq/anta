import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Inspector'

const inspector = extract(state => {
  const record = state.window.__antaInspector
  if (!record) return null
  // The Inspector's id lands on its tree; the rows are the tree's items.
  const host = state.document.getElementById(record.id)
  if (!host) return null
  const items = [...host.querySelectorAll('a-tree-item')].filter(item => item.closest('a-tree') === host)
  const rows = items.map(item => {
    const { left, right, top, bottom } = item.querySelector(':scope > a-tree-row')!.getBoundingClientRect()
    let level = 1
    for (let parent = item.parentElement?.closest('a-tree-item'); parent; parent = parent.parentElement?.closest('a-tree-item')) level++
    return {
      id: item.getAttribute('item-id') ?? '',
      type: item.getAttribute('data-type'),
      stateAttribute: item.getAttribute('state'),
      expandable: item.matches(':state(open), :state(closed)'),
      open: item.matches(':state(open)'),
      level,
      active: item.matches(':state(active)'),
      rect: { left, right, top, bottom },
    }
  })
  const tabStops = [...host.querySelectorAll('*')].filter(node => (node as HTMLElement).tabIndex >= 0)
  const focus = state.document.activeElement
  const focusedItem = focus?.localName === 'a-tree-item' && host.contains(focus) ? focus : null
  const actions = focus && host.contains(focus) ? focus.closest('a-tree-actions') : null
  const actionsStyle = actions && state.window.getComputedStyle(actions)
  const menu = host.nextElementSibling as (Element & { isOpen?: boolean }) | null
  return {
    ...record,
    rows,
    focused: focusedItem?.getAttribute('item-id') ?? null,
    // The row whose ⋯ button has focus, and whether that button shows.
    actionsRow: actions ? actions.closest('a-tree-item')!.getAttribute('item-id') ?? '' : null,
    actionsShown: !!actionsStyle && actionsStyle.visibility === 'visible' && actionsStyle.opacity === '1',
    menuOpen: menu?.localName === 'a-menu' && !!menu.isOpen,
    hostTabIndex: (host as HTMLElement).tabIndex,
    tabStops: tabStops.map(node => node.getAttribute('item-id') ?? node.localName),
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
  }
})

// The open state the item shows (its custom state, and its aria-expanded with
// it) is the one the wrapper rendered in its `state` attribute.
export const inspectorOpenMatchesItsStateAttribute = always(() => {
  const current = inspector.current
  return !current || current.rows.every(row => row.expandable
    ? row.stateAttribute === (row.open ? 'open' : 'closed')
    : row.stateAttribute === null && !row.open)
})

// One item is the Tab stop; the tree itself and the ⋯ buttons are not.
export const inspectorIsOneTabStop = always(() => {
  const current = inspector.current
  return !current || current.rows.length === 0 || (current.hostTabIndex < 0 && current.tabStops.length === 1)
})

export const inspectorHasOneActiveRowWhileFocused = always(() => {
  const current = inspector.current
  if (!current) return true
  const active = current.rows.filter(row => row.active).length
  const focused = current.focused !== null || current.actionsRow !== null
  return active <= 1 && (!focused || current.rows.length === 0 || active === 1)
})

// Focus on a row is on the active row.
export const inspectorFocusIsOnTheActiveRow = always(() => {
  const current = inspector.current
  return !current || current.focused === null || current.rows.some(row => row.active && row.id === current.focused)
})

// Focus on a ⋯ button is only ever on the active row's button, and that
// button shows, so keyboard focus is never invisible.
export const inspectorActionsFocusIsOnTheActiveRow = always(() => {
  const current = inspector.current
  if (!current || current.actionsRow === null) return true
  return current.actionsShown && current.rows.some(row => row.active && row.id === current.actionsRow)
})

// On a focused ⋯, Left and Escape return focus to its row, which stays
// active; Enter, Space, and the Menu key open the copy menu.
export const inspectorActionsKeysReturnOrOpen = always(() => {
  const before = inspector.current
  if (!before || before.actionsRow === null || before.menuOpen || before.modalOpen) return true
  return next(() => {
    const after = inspector.current
    if (after?.id !== before.id || after.expandDepth !== before.expandDepth || after.layout !== before.layout) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('PressKey' in action)) return true
    const key = action.PressKey.code
    if (key === 37 || key === 27) {
      return after.focused === before.actionsRow && after.rows.some(row => row.active && row.id === before.actionsRow)
    }
    if (key === 13 || key === 32 || key === 93) return after.menuOpen
    return true
  })
})

export const inspectorRowsNestUnderTheirParents = always(() => {
  const current = inspector.current
  if (!current || current.rows.length === 0) return true
  return current.rows[0].level === 1 && current.rows.every((row, i) =>
    i === 0 || (row.level <= current.rows[i - 1].level + 1 && row.id.startsWith('r:')))
})

// A `more` row comes right after its group's visible children, and nothing
// from that group follows it.
export const inspectorMoreRowsEndTheirGroup = always(() => {
  const current = inspector.current
  if (!current) return true
  return current.rows.every((row, i) => {
    if (row.type !== 'more') return true
    const group = `${row.id.slice(0, -1)}.`
    return current.rows.slice(0, i).some(other => other.id.startsWith(group))
      && !current.rows.slice(i + 1).some(other => other.id.startsWith(group))
  })
})

// A click on a row changes only that row's own subtree: rows elsewhere keep
// their ids, order, and open state.
export const inspectorClicksChangeOnlyTheirSubtree = always(() => {
  const before = inspector.current
  if (!before || before.modalOpen) return true
  return next(() => {
    const after = inspector.current
    if (after?.id !== before.id || after.expandDepth !== before.expandDepth || after.layout !== before.layout) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('Click' in action)) return true
    // A click makes its row the active one. The point can miss: a wheel scroll
    // that's still moving shifts the page between Bombadil's snapshot and the
    // click, so the row the click activated wins over the point.
    const activated = after.rows.find(row => row.active)
    const { x, y } = action.Click.point
    const clicked = before.rows.find(row => row.id === activated?.id)
      ?? before.rows.find(({ rect }) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
    if (!clicked) return true
    const prefix = clicked.type === 'more' ? clicked.id.slice(0, -1) : clicked.id
    const outside = (rows: typeof before.rows) => rows
      .filter(row => row.id !== clicked.id && !row.id.startsWith(`${prefix}:`) && !row.id.startsWith(`${prefix}.`))
      .map(row => `${row.id}:${row.open}`)
    return JSON.stringify(outside(after.rows)) === JSON.stringify(outside(before.rows))
  })
})
