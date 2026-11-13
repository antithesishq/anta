import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Input'

const input = extract(state => {
  const record = state.window.__antaInput
  if (!record) return null
  const host = state.document.getElementById(record.id)! as HTMLElement & { value: string }
  const control = host.shadowRoot!.querySelector('input')!
  const clear = host.querySelector('a-input-clear a-button')
  const rect = clear?.checkVisibility() ? clear.getBoundingClientRect() : null
  return {
    ...record,
    elementValue: host.value,
    nativeValue: control.value,
    blocked: record.requestedDisabled || record.requestedReadOnly,
    disabled: host.hasAttribute('disabled'),
    readOnly: host.hasAttribute('readonly'),
    nativeDisabled: control.disabled,
    nativeReadOnly: control.readOnly,
    focused: host.shadowRoot!.activeElement === control,
    start: control.selectionStart!,
    end: control.selectionEnd!,
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
    clear: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null,
  }
})

export const inputBlockingPropsMatchNativeControl = always(() => {
  const current = input.current
  return !current || (current.requestedDisabled === current.disabled && current.disabled === current.nativeDisabled
    && current.requestedReadOnly === current.readOnly && current.readOnly === current.nativeReadOnly)
})

export const inputValuesAgree = always(() => {
  const current = input.current
  return !current || (current.value === current.elementValue && current.value === current.nativeValue)
})

export const inputBlockedEditsPreserveText = always(() => {
  const before = input.current
  if (!before?.blocked) return true
  return next(() => {
    const after = input.current
    return after?.id !== before.id || after.value === before.value
  })
})

export const inputTypingReplacesSelection = always(() => {
  const before = input.current
  if (!before || !before.focused || before.blocked || before.modalOpen) return true
  return next(() => {
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('TypeText' in action)) return true
    const expected = before.value.slice(0, before.start)
      + action.TypeText.text.replace(/[\r\n]/g, '') + before.value.slice(before.end)
    return input.current?.value === expected
  })
})

export const inputClearEmptiesText = always(() => {
  const before = input.current
  if (!before?.clear || before.blocked || before.modalOpen) return true
  return next(() => {
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('Click' in action)) return true
    const { x, y } = action.Click.point
    const rect = before.clear!
    const clickedClear = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    return !clickedClear || input.current?.value === ''
  })
})

export const inputUnrelatedActionsPreserveText = always(() => {
  const before = input.current
  if (!before) return true
  return next(() => {
    const after = input.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    if ('Click' in action && before.clear) {
      const { x, y } = action.Click.point
      const rect = before.clear
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true
    }
    const unrelated = 'Click' in action || 'ScrollUp' in action || 'ScrollDown' in action || 'Custom' in action
    return !unrelated || after.value === before.value
  })
})
