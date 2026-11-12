import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Expander'

const expander = extract(state => {
  const record = state.window.__antaExpander
  if (!record) return null
  const host = state.document.getElementById(record.id)!
  const summary = host.shadowRoot!.querySelector<HTMLButtonElement>('[part="summary"]')!
  const region = host.shadowRoot!.querySelector<HTMLElement>('[part="region"]')!
  const { left, right, top, bottom } = summary.getBoundingClientRect()
  return {
    ...record,
    state: host.getAttribute('state'),
    expanded: summary.getAttribute('aria-expanded') === 'true',
    inert: region.inert,
    renderedDisabled: host.hasAttribute('disabled'),
    focused: state.document.activeElement === host && host.shadowRoot!.activeElement === summary,
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
    summary: { left, right, top, bottom },
  }
})

export const expanderDisabledPropMatchesDOM = always(() => {
  const current = expander.current
  return !current || current.requestedDisabled === current.renderedDisabled
})

export const expanderOpenStatesAgree = always(() => {
  const current = expander.current
  return !current || (current.state === (current.open ? 'open' : 'closed')
    && current.expanded === current.open && current.inert === !current.open)
})

export const expanderDisabledPreservesState = always(() => {
  const before = expander.current
  if (!before?.requestedDisabled) return true
  return next(() => {
    const after = expander.current
    return after?.id !== before.id || (after.open === before.open && after.changes === before.changes)
  })
})

export const expanderActivationToggles = always(() => {
  const before = expander.current
  if (!before || before.requestedDisabled || before.modalOpen) return true
  return next(() => {
    const after = expander.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    let activates = false
    if ('Click' in action) {
      const { x, y } = action.Click.point
      const { left, right, top, bottom } = before.summary
      activates = x >= left && x <= right && y >= top && y <= bottom
    } else if ('PressKey' in action) {
      activates = before.focused && (action.PressKey.code === 13 || action.PressKey.code === 32)
    }
    return !activates || (after.open !== before.open && after.changes === before.changes + 1)
  })
})

export const expanderUnrelatedActionsPreserveState = always(() => {
  const before = expander.current
  if (!before) return true
  return next(() => {
    const after = expander.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    if ('Click' in action) {
      const { x, y } = action.Click.point
      const { left, right, top, bottom } = before.summary
      if (x >= left && x <= right && y >= top && y <= bottom) return true
    } else if (!('ScrollUp' in action || 'ScrollDown' in action || 'Custom' in action)) return true
    return after.open === before.open && after.changes === before.changes
  })
})
