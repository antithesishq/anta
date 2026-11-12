import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Select'

const select = extract(state => {
  const record = state.window.__antaSelect
  if (!record) return null
  const root = state.document.getElementById(record.id)!
  const trigger = root.querySelector('a-input')! as HTMLElement & { value: string }
  const button = trigger.shadowRoot!.querySelector('button')!
  const menu = root.querySelector('a-menu')! as HTMLElement & { isOpen: boolean }
  const clear = menu.querySelector('a-select-footer a-menu-item')
  const rect = clear?.checkVisibility() ? clear.getBoundingClientRect() : null
  return {
    ...record,
    triggerFocused: trigger.shadowRoot!.activeElement === button,
    menuFocused: menu.contains(state.document.activeElement),
    focusedOption: menu.contains(state.document.activeElement)
      ? state.document.activeElement?.getAttribute('data-testid') ?? null : null,
    display: trigger.value,
    label: button.querySelector('[part="input-label"]')!.textContent,
    renderedDisabled: trigger.hasAttribute('disabled'),
    open: menu.isOpen,
    expanded: button.getAttribute('aria-expanded') === 'true',
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
    options: Array.from(menu.querySelectorAll('a-menu-item[data-testid]'), option => ({
      testId: option.getAttribute('data-testid'),
      value: option.getAttribute('data-testid')!.slice(record.id.length + 1),
      selected: option.hasAttribute('selected'),
      disabled: option.hasAttribute('disabled'),
    })),
    clear: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null,
  }
})

export const selectDisabledPropMatchesDOM = always(() => {
  const current = select.current
  return !current || (current.requestedDisabled === current.renderedDisabled
    && current.options.every(option => option.disabled === (current.disabledOptions.includes(option.value))))
})

export const selectSelectionMatchesDisplay = always(() => {
  const current = select.current
  if (!current) return true
  const labels: Record<string, string> = { apple: 'Apple', banana: 'Banana', orange: 'Orange' }
  const expected = current.value === null ? '' : labels[current.value]
  return current.display === expected && current.label === (expected || 'Choose a fruit')
    && current.options.every(option => option.selected === (option.value === current.value))
    && current.expanded === current.open
})

export const selectDisabledPreservesValue = always(() => {
  const before = select.current
  if (!before?.requestedDisabled) return true
  return next(() => {
    const after = select.current
    return after?.id !== before.id || after.value === before.value
  })
})

export const selectOptionClickChoosesValue = always(() => {
  const before = select.current
  if (!before?.open) return true
  return next(() => {
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('Click' in action)) return true
    const testId = (action.Click.fingerprint as typeof action.Click.fingerprint & { test_id: string | null }).test_id
    const option = before.options.find(option => option.testId === testId)
    if (!option) return true
    const after = select.current!
    if (before.requestedDisabled || before.modalOpen || before.disabledOptions.includes(option.value)) return after.value === before.value
    return after.value === option.value && !after.open
  })
})

export const selectClearResetsValue = always(() => {
  const before = select.current
  if (!before?.clear || before.requestedDisabled || before.modalOpen) return true
  return next(() => {
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('Click' in action)) return true
    const { x, y } = action.Click.point
    const rect = before.clear!
    const clickedClear = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    return !clickedClear || select.current?.value === null
  })
})

export const selectBrowsingPreservesValue = always(() => {
  const before = select.current
  if (!before) return true
  return next(() => {
    const after = select.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    if ('Click' in action) {
      const testId = (action.Click.fingerprint as typeof action.Click.fingerprint & { test_id: string | null }).test_id
      if (before.options.some(option => option.testId === testId)) return true
      const { x, y } = action.Click.point
      const rect = before.clear
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true
    } else if (!('ScrollUp' in action || 'ScrollDown' in action || 'Custom' in action)) return true
    return after.value === before.value
  })
})

export const selectKeyboardOpensNavigatesAndSelects = always(() => {
  const before = select.current
  if (!before || before.requestedDisabled || before.modalOpen) return true
  return next(() => {
    const after = select.current
    const action = lastAction.current
    if (after?.id !== before.id || !action || typeof action !== 'object' || !('PressKey' in action)) return true
    const key = action.PressKey.code
    if (!before.open && before.triggerFocused && (key === 38 || key === 40)) {
      return after.open && !!after.focusedOption && after.value === before.value
    }
    if (!before.open || !before.menuFocused) return true
    if (key === 36) {
      const first = before.options.find(option => !before.disabledOptions.includes(option.value))
      return after.open && after.focusedOption === first?.testId && after.value === before.value
    }
    const option = before.options.find(option => option.testId === before.focusedOption)
    if ((key === 13 || key === 32) && option && !before.disabledOptions.includes(option.value)) {
      return !after.open && after.value === option.value
    }
    return true
  })
})
