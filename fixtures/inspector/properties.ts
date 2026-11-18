import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Inspector'

const inspector = extract(state => {
  const record = state.window.__antaInspector
  if (!record) return null
  const host = state.document.getElementById(record.id)
  if (!host) return null
  const rows = [...host.children].filter(child => child.localName === 'a-inspector-row').map(row => {
    const { left, right, top, bottom } = row.getBoundingClientRect()
    return {
      id: row.getAttribute('row-id') ?? '',
      type: row.getAttribute('type'),
      expandable: row.hasAttribute('expandable'),
      open: row.hasAttribute('open'),
      expanded: row.getAttribute('aria-expanded'),
      level: Number(row.getAttribute('aria-level')),
      active: row.matches(':state(active)'),
      rect: { left, right, top, bottom },
    }
  })
  const tabStops = [...host.querySelectorAll('*')].filter(node => (node as HTMLElement).tabIndex >= 0).length
  return {
    ...record,
    rows,
    focused: state.document.activeElement === host,
    hostTabIndex: host.tabIndex,
    tabStops,
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
  }
})

export const inspectorOpenMatchesAriaExpanded = always(() => {
  const current = inspector.current
  return !current || current.rows.every(row => row.expandable
    ? row.expanded === String(row.open)
    : row.expanded === null && !row.open)
})

export const inspectorIsOneTabStop = always(() => {
  const current = inspector.current
  return !current || (current.hostTabIndex === 0 && current.tabStops === 0)
})

export const inspectorHasOneActiveRowWhileFocused = always(() => {
  const current = inspector.current
  if (!current) return true
  const active = current.rows.filter(row => row.active).length
  return active <= 1 && (!current.focused || current.rows.length === 0 || active === 1)
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
    const { x, y } = action.Click.point
    const clicked = before.rows.find(({ rect }) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
    if (!clicked) return true
    const prefix = clicked.type === 'more' ? clicked.id.slice(0, -1) : clicked.id
    const outside = (rows: typeof before.rows) => rows
      .filter(row => row.id !== clicked.id && !row.id.startsWith(`${prefix}:`) && !row.id.startsWith(`${prefix}.`))
      .map(row => `${row.id}:${row.open}`)
    return JSON.stringify(outside(after.rows)) === JSON.stringify(outside(before.rows))
  })
})
