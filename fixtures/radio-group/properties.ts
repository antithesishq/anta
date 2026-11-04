import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type { ARadioGroupElement } from '../../src/elements/a-radio-group'
import type { ARadioElement } from '../../src/elements/a-radio'
import type {} from './RadioGroup'

const radio = extract(state => {
  const record = state.window.__antaRadioGroup
  if (!record) return null
  const group = state.document.getElementById(record.id)! as ARadioGroupElement
  return {
    ...record,
    disabled: group.hasAttribute('disabled'),
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
    focused: group.contains(state.document.activeElement) ? state.document.activeElement!.getAttribute('value') : null,
    groupValue: group.value,
    options: Array.from(group.querySelectorAll<ARadioElement>('a-radio'), option => ({
      testId: option.getAttribute('data-testid'),
      value: option.value,
      selected: option.selected,
      disabled: option.hasAttribute('disabled'),
    })),
  }
})

export const radioKeyboardFollowsFocus = always(() => {
  const before = radio.current
  if (!before?.focused || before.disabled || before.modalOpen) return true
  return next(() => {
    const action = lastAction.current
    const after = radio.current
    if (!after || after.id !== before.id || !action || typeof action !== 'object' || !('PressKey' in action)) return true
    const enabled = before.options.filter(option => !option.disabled)
    const index = enabled.findIndex(option => option.value === before.focused)
    if (index < 0) return true
    const key = action.PressKey.code
    const offset = key === 37 || key === 38 ? -1 : key === 39 || key === 40 ? 1 : 0
    if (!offset && key !== 13 && key !== 32) return true
    const expected = enabled[(index + offset + enabled.length) % enabled.length].value
    return after.value === expected && after.focused === expected
      && after.changes === before.changes + (expected === before.value ? 0 : 1)
  })
})

export const radioSelectionMatchesState = always(() => {
  const current = radio.current
  if (!current) return true
  const selected = current.options.filter(option => option.selected)
  return current.groupValue === current.value && (current.value === ''
    ? selected.length === 0
    : selected.length === 1 && selected[0].value === current.value)
})

export const radioDisabledDoesNotChange = always(() => {
  const before = radio.current
  if (!before?.disabled) return true
  return next(() => {
    const after = radio.current
    return after?.id !== before.id
      || (after.value === before.value && after.changes === before.changes)
  })
})

export const radioActionsChangeOnlyTheirSelection = always(() => {
  const before = radio.current
  if (!before) return true
  return next(() => {
    const after = radio.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    if (!('Click' in action || 'ScrollUp' in action || 'ScrollDown' in action || 'Custom' in action)) return true
    // Bombadil 0.7.10 serializes action fingerprint fields with snake_case.
    const testId = 'Click' in action
      ? (action.Click.fingerprint as typeof action.Click.fingerprint & { test_id: string | null }).test_id
      : null
    const picked = before.options.find(option => option.testId === testId)
    const changes = picked && !before.modalOpen && !before.disabled && !picked.disabled && picked.value !== before.value ? 1 : 0
    return after.value === (changes ? picked!.value : before.value)
      && after.changes === before.changes + changes
  })
})
