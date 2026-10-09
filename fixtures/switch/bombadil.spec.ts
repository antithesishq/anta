import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForSwitchFixture = registerCustomAction(
  'waitForSwitchFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (!document.querySelector('[data-fixture="switch"]')) {
      if (Date.now() >= deadline) throw new Error('Switch fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const focusAndPressSpace = registerCustomAction(
  'switchFocusAndPressSpace',
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
  const root = state.document.querySelector<HTMLElement>('[data-fixture="switch"]')
  if (!root) return null

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
  }
})

export const switchKeyboardActions = actions(() => (
  fixture.current?.canFocusAndPressSpace ? [focusAndPressSpace()] : []
))

export const switchReadyActions = actions(() => (
  fixture.current === null ? [waitForSwitchFixture()] : []
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
