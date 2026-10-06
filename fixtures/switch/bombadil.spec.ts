import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const focusAndPressSpace = registerCustomAction(
  'switchFocusAndPressSpace',
  async (document, window) => {
    const target = document.querySelector<HTMLElement>('[data-fixture-target]')
    if (!target || target.matches(':disabled')) return

    target.focus()
    target.dispatchEvent(new window.KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    }))
    target.dispatchEvent(new window.KeyboardEvent('keyup', {
      key: ' ',
      code: 'Space',
      bubbles: true,
      cancelable: true,
    }))
  },
)

const fixture = extract((state) => {
  const root = state.document.querySelector<HTMLElement>('[data-fixture="switch"]')
  const form = state.document.querySelector<HTMLFormElement>('[data-fixture-form]')
  if (!root || !form) return null

  const target = root.querySelector<HTMLElement & { checked: boolean }>('[data-fixture-target]')
  const expectedChecked = root.dataset.expectedChecked === 'true'
  const expectedDisabled = root.dataset.expectedDisabled === 'true'
  const expectedMounted = root.dataset.expectedMounted === 'true'

  return {
    actualChecked: target?.checked ?? null,
    actualCheckedState: target?.matches(':state(checked)') ?? null,
    actualDisabled: target?.hasAttribute('disabled') ?? null,
    actualMounted: target !== null,
    actualTabIndex: target?.tabIndex ?? null,
    canFocusAndPressSpace: target !== null && !target.matches(':disabled'),
    expectedChecked,
    expectedDisabled,
    expectedMounted,
    formValues: new state.window.FormData(form).getAll('automatic-updates').map(String),
  }
})

export const switchKeyboardActions = actions(() => (
  fixture.current?.canFocusAndPressSpace ? [focusAndPressSpace()] : []
))

export const switchMountMatchesParent = always(() => {
  const current = fixture.current
  return current === null || current.actualMounted === current.expectedMounted
})

export const switchCheckedStateMatchesParent = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted) return true
  return current.actualChecked === current.expectedChecked
    && current.actualCheckedState === current.expectedChecked
})

export const switchDisabledStateMatchesParent = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted) return true
  return current.actualDisabled === current.expectedDisabled
    && current.actualTabIndex === (current.expectedDisabled ? -1 : 0)
})

export const switchFormValueMatchesState = always(() => {
  const current = fixture.current
  if (current === null) return true
  const shouldSubmit = current.expectedMounted && current.expectedChecked && !current.expectedDisabled
  return shouldSubmit
    ? current.formValues.length === 1 && current.formValues[0] === 'enabled'
    : current.formValues.length === 0
})
