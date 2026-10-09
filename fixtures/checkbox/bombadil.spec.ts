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
  if (!root) return null

  const target = root.querySelector<HTMLElement & { checked: boolean; indeterminate: boolean }>('[data-fixture-target]')
  const expectedChecked = root.dataset.expectedChecked
  const expectedDisabled = root.dataset.expectedDisabled === 'true'
  const expectedMounted = root.dataset.expectedMounted === 'true'

  return {
    actualChecked: target?.checked ?? null,
    actualCheckedState: target?.matches(':state(checked)') ?? null,
    actualDisabled: target?.matches(':disabled') ?? null,
    actualIndeterminate: target?.indeterminate ?? null,
    actualIndeterminateState: target?.matches(':state(indeterminate)') ?? null,
    actualMounted: target !== null,
    actualStateAttribute: target?.getAttribute('state') ?? null,
    actualTabIndex: target?.tabIndex ?? null,
    canFocusAndPressSpace: target !== null && !target.matches(':disabled'),
    expectedChecked,
    expectedDisabled,
    expectedMounted,
    lastTransition: root.dataset.lastTransition ?? null,
  }
})

export const checkboxKeyboardActions = actions(() => (
  fixture.current?.canFocusAndPressSpace ? [focusAndPressSpace()] : []
))

export const checkboxReadyActions = actions(() => (
  fixture.current === null ? [waitForCheckboxFixture()] : []
))

export const checkboxFollowsStateMachine = always(() => {
  const current = fixture.current
  if (current === null) return true
  if (current.actualMounted !== current.expectedMounted) return false
  if (!current.expectedMounted) return true

  const expectedIsChecked = current.expectedChecked === 'true'
  const expectedIsIndeterminate = current.expectedChecked === 'indeterminate'
  const expectedState = expectedIsChecked
    ? 'checked'
    : expectedIsIndeterminate
      ? 'indeterminate'
      : 'unchecked'

  const stateMatches = current.actualChecked === expectedIsChecked
    && current.actualIndeterminate === expectedIsIndeterminate
    && current.actualCheckedState === expectedIsChecked
    && current.actualIndeterminateState === expectedIsIndeterminate
    && current.actualStateAttribute === expectedState
    && !(current.actualChecked && current.actualIndeterminate)
    && !(current.actualCheckedState && current.actualIndeterminateState)
    && current.actualDisabled === current.expectedDisabled
    && current.actualTabIndex === (current.expectedDisabled ? -1 : 0)
  if (!stateMatches) return false
  if (current.lastTransition === null) return true

  const [prev, next] = current.lastTransition.split('>')
  const expectedNext = prev === 'true'
    ? 'false'
    : prev === 'false' || prev === 'indeterminate'
      ? 'true'
      : null
  return expectedNext !== null
    && next === expectedNext
    && current.expectedChecked === next
})
