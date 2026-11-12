import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type { ASwitchElement } from '../../src/elements/a-switch'
import type {} from './Switch'

const control = extract(state => {
  const record = state.window.__antaSwitch
  if (!record) return null
  const target = state.document.getElementById(record.id)! as ASwitchElement
  return {
    ...record,
    focused: state.document.activeElement === target,
    renderedDisabled: target.hasAttribute('disabled'),
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
    renderedValue: target.checked,
  }
})

export const switchDisabledPropMatchesDOM = always(() => {
  const current = control.current
  return !current || current.requestedDisabled === current.renderedDisabled
})

export const switchDOMMatchesState = always(() => {
  const current = control.current
  return !current || current.renderedValue === current.value
})

export const switchDisabledDoesNotChange = always(() => {
  const before = control.current
  if (!before?.requestedDisabled) return true
  return next(() => {
    const after = control.current
    return after?.id !== before.id
      || (after.changes === before.changes && after.value === before.value)
  })
})

export const switchActionsChangeOnlyItsValue = always(() => {
  const before = control.current
  if (!before) return true
  return next(() => {
    const after = control.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    if (!('Click' in action || 'PressKey' in action || 'ScrollUp' in action || 'ScrollDown' in action || 'Custom' in action)) return true
    const clicked = 'Click' in action && action.Click.fingerprint.id === before.id
    const pressedActivationKey = 'PressKey' in action && before.focused && action.PressKey.code === 32
    const toggles = (clicked || pressedActivationKey) && !before.requestedDisabled && !before.modalOpen
    return after.changes === before.changes + (toggles ? 1 : 0)
      && after.value === (toggles ? !before.value : before.value)
  })
})
