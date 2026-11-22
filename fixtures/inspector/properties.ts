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
    // Below the root, ids start `r/`, or `r~` for the root's own ranges and lines.
    i === 0 || (row.level <= current.rows[i - 1].level + 1 && /^r[/~]/.test(row.id)))
})

// Rows are listed in document order, so a row's subtree is the run of deeper
// rows right after it. A range's children have ids under their group, not
// under the range, so ids alone can't tell what a range holds.
type Row = { id: string; level: number; open: boolean; type: string | null }
const subtree = <R extends Row>(rows: R[], i: number) => {
  const end = rows.findIndex((row, j) => j > i && row.level <= rows[i].level)
  return rows.slice(i + 1, end === -1 ? rows.length : end)
}
const range = (id: string) => id.match(/~(\d+)-(\d+)$/)!.slice(1).map(Number) as [number, number]

// A string's `more` row (`<node>~line+`) comes right after its lines, and no
// line follows it.
export const inspectorMoreRowsEndTheirLines = always(() => {
  const current = inspector.current
  if (!current) return true
  return current.rows.every((row, i) => {
    if (row.type !== 'more') return true
    const node = row.id.slice(0, row.id.indexOf('~'))
    const line = (other: typeof row) => other.id.startsWith(`${node}~line:`)
    return row.id.endsWith('~line+') && current.rows[i - 1] && line(current.rows[i - 1])
      && !current.rows.slice(i + 1).some(line)
  })
})

// A group's ranges cover its children in order, with no gap or overlap: the
// top ranges start at 0, and an open range holds either smaller ranges that
// cover it, or exactly its own children.
export const inspectorRangesCoverTheirGroup = always(() => {
  const current = inspector.current
  if (!current) return true
  const rows = current.rows
  const tiles = (children: Row[], start: number, end?: number) => {
    let next = start
    for (const child of children) {
      if (child.type !== 'chunk') return false
      const [first, last] = range(child.id)
      if (first !== next || last < first) return false
      next = last + 1
    }
    return end === undefined || next === end + 1
  }
  return rows.every((row, i) => {
    if (row.type === 'chunk') {
      if (!row.open) return true
      const [start, end] = range(row.id)
      const children = subtree(rows, i).filter(child => child.level === row.level + 1)
      return children.every(child => child.type === 'chunk')
        ? tiles(children, start, end)
        : children.every(child => child.type !== 'chunk') && children.length === end - start + 1
    }
    // A node's top ranges, for each of its groups, start at 0 and follow on.
    if (row.type !== 'node' || !row.open) return true
    const children = subtree(rows, i).filter(child => child.level === row.level + 1)
    const groups = new Map<string, Row[]>()
    for (const child of children) {
      if (child.type !== 'chunk') continue
      const group = child.id.slice(0, child.id.lastIndexOf('~'))
      groups.set(group, [...(groups.get(group) ?? []), child])
    }
    return [...groups.values()].every(group => tiles(group, 0))
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
    // A more row adds lines to its string, the row above it.
    const owner = clicked.type === 'more' ? clicked.id.slice(0, clicked.id.indexOf('~')) : clicked.id
    const outside = (rows: typeof before.rows) => {
      const i = rows.findIndex(row => row.id === owner)
      const inside = new Set(i === -1 ? [] : [owner, ...subtree(rows, i).map(row => row.id)])
      return rows.filter(row => row.id !== clicked.id && !inside.has(row.id)).map(row => `${row.id}:${row.open}`)
    }
    return JSON.stringify(outside(after.rows)) === JSON.stringify(outside(before.rows))
  })
})
