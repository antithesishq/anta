import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Tabs'

const tabs = extract(state => {
  const record = state.window.__antaTabs
  if (!record) return null
  const strip = state.document.getElementById(record.id)! as HTMLElement & { value: string }
  return {
    ...record,
    attributeValue: strip.getAttribute('state'),
    elementValue: strip.value,
    disabled: strip.hasAttribute('disabled'),
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
    focused: strip.contains(state.document.activeElement)
      ? state.document.activeElement!.getAttribute('value') : null,
    options: Array.from(strip.querySelectorAll<HTMLElement & { selected: boolean }>('a-tab'), tab => ({
      testId: tab.getAttribute('data-testid'),
      value: tab.getAttribute('value')!,
      selected: tab.selected,
      disabled: tab.hasAttribute('disabled'),
    })),
    visiblePanels: Array.from(strip.parentElement!.querySelectorAll('a-tabpanel'))
      .filter(panel => panel.checkVisibility()).map(panel => panel.getAttribute('value')),
  }
})

export const tabsSelectionMatchesState = always(() => {
  const current = tabs.current
  if (!current) return true
  const selected = current.options.filter(tab => tab.selected)
  return current.value === current.attributeValue && current.value === current.elementValue
    && selected.length === 1 && selected[0].value === current.value
    && current.visiblePanels.length === 1 && current.visiblePanels[0] === current.value
})

export const tabsDisabledDoesNotChange = always(() => {
  const before = tabs.current
  if (!before?.disabled) return true
  return next(() => {
    const after = tabs.current
    return after?.id !== before.id
      || (after.value === before.value && after.changes === before.changes)
  })
})

export const tabsActionsChangeOnlyTheirSelection = always(() => {
  const before = tabs.current
  if (!before) return true
  return next(() => {
    const after = tabs.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    let expected = before.value
    if ('Click' in action) {
      // Bombadil 0.7.10 uses snake_case in recorded fingerprints.
      const testId = (action.Click.fingerprint as typeof action.Click.fingerprint & { test_id: string | null }).test_id
      const picked = before.options.find(tab => tab.testId === testId)
      if (picked && !picked.disabled && !before.disabled && !before.modalOpen) expected = picked.value
    } else if ('PressKey' in action) {
      if (!before.focused) return true
      if (!before.disabled && !before.modalOpen) {
        const enabled = before.options.filter(tab => !tab.disabled)
        const index = enabled.findIndex(tab => tab.value === before.focused)
        switch (action.PressKey.code) {
          case 37: expected = enabled[(index - 1 + enabled.length) % enabled.length].value; break
          case 39: expected = enabled[(index + 1) % enabled.length].value; break
          case 36: expected = enabled[0].value; break
          case 35: expected = enabled[enabled.length - 1].value; break
          default: return true
        }
        if (after.focused !== expected) return false
      }
    } else if (!('ScrollUp' in action || 'ScrollDown' in action || 'Custom' in action)) return true
    return after.value === expected
      && after.changes === before.changes + (expected !== before.value ? 1 : 0)
  })
})
