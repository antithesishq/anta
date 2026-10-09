import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForCheckboxFixture = registerCustomAction(
  'waitForCheckboxFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (document.querySelectorAll('[data-fixture="checkbox"] [data-fixture-target]').length !== 5) {
      if (Date.now() >= deadline) throw new Error('Checkbox fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const focusAndPressSpace = registerCustomAction(
  'checkboxFocusAndPressSpace',
  async (document, window, targetIndex: number) => {
    const target = document.querySelectorAll<HTMLElement>('[data-fixture-target]')[targetIndex]
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

  const targets = Array.from(root.querySelectorAll<HTMLElement & { checked: boolean; indeterminate: boolean }>('[data-fixture-target]'), (target) => ({
    checked: target.checked,
    checkedState: target.matches(':state(checked)'),
    disabled: target.matches(':disabled'),
    indeterminate: target.indeterminate,
    indeterminateState: target.matches(':state(indeterminate)'),
    stateAttribute: target.getAttribute('state'),
    tabIndex: target.tabIndex,
  }))
  return {
    targets,
  }
})

export const checkboxKeyboardActions = actions(() => (
  fixture.current?.targets.flatMap((target: { disabled: boolean }, targetIndex: number) =>
    target.disabled ? [] : [focusAndPressSpace(targetIndex)]) ?? []
))

export const checkboxReadyActions = actions(() => (
  fixture.current === null ? [waitForCheckboxFixture()] : []
))

export const checkboxStateIsCoherent = always(() => {
  const current = fixture.current
  if (current === null) return true
  return current.targets.every((target: {
    checked: boolean
    checkedState: boolean
    disabled: boolean
    indeterminate: boolean
    indeterminateState: boolean
    stateAttribute: string | null
    tabIndex: number
  }) => target.stateAttribute === null
    && target.checked === target.checkedState
    && target.indeterminate === target.indeterminateState
    && !(target.checked && target.indeterminate)
    && !(target.checkedState && target.indeterminateState)
    && target.tabIndex === (target.disabled ? -1 : 0))
})
