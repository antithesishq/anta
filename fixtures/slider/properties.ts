import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Slider'

const slider = extract(state => {
  const record = state.window.__antaSlider
  if (!record) return null
  const target = state.document.getElementById(record.id)! as HTMLElement & { value: number }
  const thumb = target.shadowRoot!.querySelector('[part~="thumb-1"]')!.getBoundingClientRect()
  return {
    ...record,
    applied: target.value,
    attributeValue: target.getAttribute('value'),
    min: Number(target.getAttribute('min')),
    max: Number(target.getAttribute('max')),
    step: Number(target.getAttribute('step')),
    disabled: target.hasAttribute('disabled'),
    dragging: target.shadowRoot!.querySelector('[part~="control"]')!.hasAttribute('data-dragging'),
    focused: state.document.activeElement === target,
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
    thumb: { left: thumb.left, right: thumb.right, top: thumb.top, bottom: thumb.bottom },
    thumbHittable: target.contains(state.document.elementFromPoint(thumb.left + thumb.width / 2, thumb.top + thumb.height / 2)),
  }
})

export const sliderEnabledDragChangesValue = always(() => {
  const before = slider.current
  if (!before || before.disabled || before.modalOpen || !before.thumbHittable) return true
  return next(() => {
    const action = lastAction.current
    const after = slider.current
    if (!after || after.id !== before.id || !action || typeof action !== 'object' || !('MouseDrag' in action)) return true
    if (after.thumb.top !== before.thumb.top) return true
    const { from, to } = action.MouseDrag
    const { left, right, top, bottom } = before.thumb
    if (from.x < left || from.x > right || from.y < top || from.y > bottom || Math.abs(to.x - from.x) < 20) return true
    if ((to.x > from.x && before.value >= before.max) || (to.x < from.x && before.value <= before.min)) return true
    return to.x > from.x ? after.value > before.value : after.value < before.value
  })
})

export const sliderValueIsValid = always(() => {
  const current = slider.current
  return !current || (current.applied >= current.min && current.applied <= current.max
    && (current.applied - current.min) % current.step === 0)
})

export const sliderStateMatchesDOM = always(() => {
  const current = slider.current
  return !current || (String(current.value) === current.attributeValue && current.value === current.applied)
})

export const sliderDisabledDoesNotChange = always(() => {
  const before = slider.current
  if (!before?.disabled) return true
  return next(() => {
    const after = slider.current
    return after?.id !== before.id
      || (after.value === before.value && after.changes === before.changes)
  })
})

export const sliderDisabledEndsDrag = always(() => {
  const current = slider.current
  return !current || !current.disabled || !current.dragging
})

export const sliderUnrelatedActionsPreserveValue = always(() => {
  const before = slider.current
  if (!before) return true
  return next(() => {
    const after = slider.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    const unrelated = 'ScrollUp' in action || 'ScrollDown' in action || 'Custom' in action
      || ('Click' in action && action.Click.fingerprint.id !== before.id && action.Click.fingerprint.role !== 'slider')
    return !unrelated || (after.value === before.value && after.changes === before.changes)
  })
})

export const sliderKeyboardChangesValue = always(() => {
  const before = slider.current
  if (!before || !before.focused || before.disabled || before.modalOpen) return true
  return next(() => {
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('PressKey' in action)) return true
    const { min, max, step, applied } = before
    const requested = ({ 37: applied - step, 39: applied + step, 36: min, 35: max } as Record<number, number>)[action.PressKey.code]
    if (requested === undefined) return true
    const expected = Math.min(max, Math.max(min, requested))
    const after = slider.current!
    const changed = expected !== applied
    return after.applied === expected
      && after.changes === before.changes + (changed ? 1 : 0)
      && after.value === (changed ? expected : before.value)
  })
})
