import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Tree'

const tree = extract(state => {
  const record = state.window.__antaTree
  if (!record) return null
  const host = state.document.getElementById(record.id)
  if (!host) return null
  const items = [...host.querySelectorAll('a-tree-item')].filter(item => item.closest('a-tree') === host)
  const rows = items.map(item => {
    const { left, right, top, bottom } = item.querySelector(':scope > a-tree-row')!.getBoundingClientRect()
    const ancestors: string[] = []
    for (let parent = item.parentElement?.closest('a-tree-item'); parent; parent = parent.parentElement?.closest('a-tree-item')) {
      ancestors.push(parent.getAttribute('item-id') ?? '')
    }
    return {
      id: item.getAttribute('item-id') ?? '',
      ancestors,
      stateAttribute: item.getAttribute('state'),
      expandable: item.matches(':state(open), :state(closed)'),
      open: item.matches(':state(open)'),
      disabled: item.hasAttribute('disabled'),
      active: item.matches(':state(active)'),
      rect: { left, right, top, bottom },
    }
  })
  const tabStops = [...host.querySelectorAll('*')].filter(node => (node as HTMLElement).tabIndex >= 0)
  const focus = state.document.activeElement
  const focusedItem = focus?.localName === 'a-tree-item' && host.contains(focus) ? focus : null
  const actions = focus && host.contains(focus) ? focus.closest('a-tree-actions') : null
  const actionsStyle = actions && state.window.getComputedStyle(actions)
  const controls = actions ? [...actions.querySelectorAll('a-button')] : []
  const menu = host.nextElementSibling as (Element & { isOpen?: boolean }) | null
  return {
    ...record,
    rows,
    focused: focusedItem?.getAttribute('item-id') ?? null,
    // The row whose action has focus, which action, and whether they show.
    actionsRow: actions ? actions.closest('a-tree-item')!.getAttribute('item-id') ?? '' : null,
    actionIndex: controls.findIndex(control => control === focus || control.contains(focus)),
    actionCount: controls.length,
    actionsShown: !!actionsStyle && actionsStyle.visibility === 'visible' && actionsStyle.opacity === '1',
    menuOpen: menu?.localName === 'a-menu' && !!menu.isOpen,
    hostTabIndex: (host as HTMLElement).tabIndex,
    tabStops: tabStops.length,
    opened: host.closest('[data-tree-fixture]')?.getAttribute('data-opened') ?? null,
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
  }
})

const sameFixture = (a: { id: string; controlled: boolean; indicatorPlacement: string; folderIcons: boolean }, b: typeof a | null) =>
  !!b && a.id === b.id && a.controlled === b.controlled && a.indicatorPlacement === b.indicatorPlacement && a.folderIcons === b.folderIcons

// The open state an item shows (its custom state, and its aria-expanded with
// it) is the one the wrapper rendered in its `state` attribute.
export const treeOpenMatchesItsStateAttribute = always(() => {
  const current = tree.current
  return !current || current.rows.every(row => row.expandable
    ? row.stateAttribute === (row.open ? 'open' : 'closed')
    : row.stateAttribute === null && !row.open)
})

// However many rows and actions, exactly one item is a Tab stop.
export const treeIsOneTabStop = always(() => {
  const current = tree.current
  return !current || current.rows.length === 0 || (current.hostTabIndex < 0 && current.tabStops === 1)
})

// Focus on an item is on the active item; focus on an action is on the active
// row's actions, which show, so keyboard focus is never invisible.
export const treeFocusIsOnTheActiveRow = always(() => {
  const current = tree.current
  if (!current) return true
  const focused = current.focused ?? current.actionsRow
  if (focused === null) return true
  const active = current.rows.filter(row => row.active)
  return active.length === 1 && active[0].id === focused && (current.actionsRow === null || current.actionsShown)
})

// A disabled folder never opens.
export const treeDisabledItemsStayClosed = always(() => {
  const current = tree.current
  return !current || current.rows.every(row => !row.disabled || !row.open)
})

// On a focused action, Right moves to the next action (staying on the last),
// Left to the previous one, and Left on the first or Escape returns to its row.
export const treeActionKeysMoveAndReturn = always(() => {
  const before = tree.current
  if (!before || before.actionsRow === null || before.menuOpen || before.modalOpen) return true
  return next(() => {
    const after = tree.current
    if (!after || !sameFixture(before, after)) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('PressKey' in action)) return true
    const key = action.PressKey.code
    const onAction = (index: number) => after.actionsRow === before.actionsRow && after.actionIndex === index
    if (key === 39) return onAction(Math.min(before.actionIndex + 1, before.actionCount - 1))
    if (key === 37 && before.actionIndex > 0) return onAction(before.actionIndex - 1)
    if (key === 37 || key === 27) return after.focused === before.actionsRow
    return true
  })
})

// A click on a row changes only that row's subtree: rows elsewhere keep their
// order and open state.
export const treeClicksChangeOnlyTheirSubtree = always(() => {
  const before = tree.current
  if (!before || before.modalOpen) return true
  return next(() => {
    const after = tree.current
    if (!after || !sameFixture(before, after)) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('Click' in action)) return true
    // The row the click made active wins over the point, which a scroll still
    // moving can shift between the snapshot and the click.
    const activated = after.rows.find(row => row.active)
    const { x, y } = action.Click.point
    const clicked = before.rows.find(row => row.id === activated?.id)
      ?? before.rows.find(({ rect }) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
    if (!clicked) return true
    const outside = (rows: typeof before.rows) => rows
      .filter(row => row.id !== clicked.id && !row.ancestors.includes(clicked.id))
      .map(row => `${row.id}:${row.open}`)
    return JSON.stringify(outside(after.rows)) === JSON.stringify(outside(before.rows))
  })
})

// Enter on a file selects it: its onClick runs.
export const treeEnterOnAFileSelectsIt = always(() => {
  const before = tree.current
  if (!before || before.focused === null || before.menuOpen || before.modalOpen) return true
  const row = before.rows.find(candidate => candidate.id === before.focused)
  if (!row || row.expandable) return true
  return next(() => {
    const after = tree.current
    if (!after || !sameFixture(before, after)) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('PressKey' in action) || action.PressKey.code !== 13) return true
    return after.opened === row.id
  })
})
