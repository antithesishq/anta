import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForCheckboxFixture = registerCustomAction(
  'waitForCheckboxFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (!document.querySelector('[data-fixture="checkbox"]')) {
      if (Date.now() >= deadline) throw new Error('Checkbox fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const focusAndPressSpace = registerCustomAction(
  'checkboxFocusAndPressSpace',
  async (document, window) => {
    const target = document.querySelector<HTMLElement>('[data-fixture-target]')
    if (!target || target.matches(':disabled')) return
    const browser = window as unknown as typeof globalThis

    target.focus()
    target.dispatchEvent(new browser.KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    }))
    target.dispatchEvent(new browser.KeyboardEvent('keyup', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    }))
  },
)

const fixture = extract((state) => {
  const root = state.document.querySelector<HTMLElement>('[data-fixture="checkbox"]')
  const form = state.document.querySelector<HTMLFormElement>('[data-fixture-form]')
  if (!root || !form) return null

  const target = root.querySelector<HTMLElement & { checked: boolean; indeterminate: boolean }>('[data-fixture-target]')
  const expectedChecked = root.dataset.expectedChecked
  const expectedDisabled = root.dataset.expectedDisabled === 'true'
  const expectedMounted = root.dataset.expectedMounted === 'true'
  const expectedValue = root.dataset.expectedValue ?? ''

  return {
    actualChecked: target?.checked ?? null,
    actualCheckedState: target?.matches(':state(checked)') ?? null,
    actualDisabled: target?.matches(':disabled') ?? null,
    actualIndeterminate: target?.indeterminate ?? null,
    actualIndeterminateState: target?.matches(':state(indeterminate)') ?? null,
    actualMounted: target !== null,
    actualStateAttribute: target?.getAttribute('state') ?? null,
    actualTabIndex: target?.tabIndex ?? null,
    actualValue: target?.getAttribute('value') ?? null,
    canFocusAndPressSpace: target !== null && !target.matches(':disabled'),
    expectedChecked,
    expectedDisabled,
    expectedMounted,
    expectedValue,
    formValues: new (state.window as unknown as typeof globalThis).FormData(form).getAll('notification-scope').map(String),
  }
})

export const checkboxKeyboardActions = actions(() => (
  fixture.current?.canFocusAndPressSpace ? [focusAndPressSpace()] : []
))

export const checkboxReadyActions = actions(() => (
  fixture.current === null ? [waitForCheckboxFixture()] : []
))

export const checkboxMountMatchesParent = always(() => {
  const current = fixture.current
  return current === null || current.actualMounted === current.expectedMounted
})

export const checkboxStateMatchesParent = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted) return true

  const expectedIsChecked = current.expectedChecked === 'true'
  const expectedIsIndeterminate = current.expectedChecked === 'indeterminate'
  const expectedState = expectedIsChecked
    ? 'checked'
    : expectedIsIndeterminate
      ? 'indeterminate'
      : 'unchecked'

  return current.actualChecked === expectedIsChecked
    && current.actualIndeterminate === expectedIsIndeterminate
    && current.actualCheckedState === expectedIsChecked
    && current.actualIndeterminateState === expectedIsIndeterminate
    && current.actualStateAttribute === expectedState
    && !(current.actualChecked && current.actualIndeterminate)
    && !(current.actualCheckedState && current.actualIndeterminateState)
})

export const checkboxDisabledStateMatchesParent = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted) return true
  return current.actualDisabled === current.expectedDisabled
    && current.actualTabIndex === (current.expectedDisabled ? -1 : 0)
})

export const checkboxFormValueMatchesState = always(() => {
  const current = fixture.current
  if (current === null) return true

  const shouldSubmit = current.expectedMounted
    && current.expectedChecked === 'true'
    && !current.expectedDisabled

  if (!current.expectedMounted) return current.formValues.length === 0
  if (current.actualValue !== current.expectedValue) return false

  return shouldSubmit
    ? current.formValues.length === 1 && current.formValues[0] === current.expectedValue
    : current.formValues.length === 0
})
