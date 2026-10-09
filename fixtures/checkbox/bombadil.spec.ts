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
  }
})

export const checkboxKeyboardActions = actions(() => (
  fixture.current?.canFocusAndPressSpace ? [focusAndPressSpace()] : []
))

export const checkboxReadyActions = actions(() => (
  fixture.current === null ? [waitForCheckboxFixture()] : []
))

export const checkboxStateIsCoherent = always(() => {
  const current = fixture.current
  if (current === null || !current.actualMounted) return true
  if (current.actualStateAttribute !== null) return false

  return current.actualChecked === current.actualCheckedState
    && current.actualIndeterminate === current.actualIndeterminateState
    && !(current.actualChecked && current.actualIndeterminate)
    && !(current.actualCheckedState && current.actualIndeterminateState)
    && current.actualTabIndex === (current.actualDisabled ? -1 : 0)
})
