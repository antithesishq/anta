import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Button'

const button = extract(state => {
  const counter = state.window.__antaButton
  if (!counter) return null
  const target = state.document.getElementById(counter.id)!
  return {
    ...counter,
    renderedDisabled: target.hasAttribute('disabled'),
    renderedLoading: target.hasAttribute('loading'),
    blocked: counter.requestedDisabled || counter.requestedLoading,
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
  }
})

export const buttonBlockingPropsMatchDOM = always(() => {
  const current = button.current
  return !current || (current.requestedDisabled === current.renderedDisabled
    && current.requestedLoading === current.renderedLoading)
})

export const buttonDisabledOrLoadingDoesNotActivate = always(() => {
  const before = button.current
  if (!before?.blocked) return true
  return next(() => {
    const after = button.current
    return after?.id !== before.id || after.activations === before.activations
  })
})

export const buttonActionsChangeOnlyItsCounter = always(() => {
  const before = button.current
  if (!before) return true
  return next(() => {
    const after = button.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    if (!('Click' in action || 'ScrollUp' in action || 'ScrollDown' in action || 'Custom' in action)) return true
    const activates = 'Click' in action && action.Click.fingerprint.id === before.id && !before.blocked && !before.modalOpen
    return after.activations === before.activations + (activates ? 1 : 0)
  })
})
