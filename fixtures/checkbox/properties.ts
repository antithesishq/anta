import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Checkbox'

const checkbox = extract(state => {
  const record = state.window.__antaCheckbox
  if (!record) return null
  const target = state.document.getElementById(record.id)! as HTMLElement & {
    checked: boolean; indeterminate: boolean
  }
  return {
    ...record,
    disabled: target.hasAttribute('disabled'),
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
    renderedValue: target.indeterminate ? 'indeterminate' : target.checked,
  }
})

export const checkboxDOMMatchesState = always(() => {
  const current = checkbox.current
  return !current || current.renderedValue === current.value
})

export const checkboxDisabledDoesNotChange = always(() => {
  const before = checkbox.current
  if (!before?.disabled) return true
  return next(() => {
    const after = checkbox.current
    return after?.id !== before.id
      || (after.changes === before.changes && after.value === before.value)
  })
})

export const checkboxActionsChangeOnlyItsValue = always(() => {
  const before = checkbox.current
  if (!before) return true
  return next(() => {
    const after = checkbox.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    if (!('Click' in action || 'ScrollUp' in action || 'ScrollDown' in action || 'Custom' in action)) return true
    const toggles = 'Click' in action && action.Click.fingerprint.id === before.id && !before.disabled && !before.modalOpen
    return after.changes === before.changes + (toggles ? 1 : 0)
      && after.value === (toggles ? before.value !== true : before.value)
  })
})
