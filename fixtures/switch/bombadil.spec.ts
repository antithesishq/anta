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
  return {
    actualChecked: target?.checked ?? null,
    actualCheckedState: target?.matches(':state(checked)') ?? null,
    actualDisabled: target?.hasAttribute('disabled') ?? null,
    actualMounted: target !== null,
    actualTabIndex: target?.tabIndex ?? null,
    canFocusAndPressSpace: target !== null && !target.matches(':disabled'),
  }
})

export const switchKeyboardActions = actions(() => (
  fixture.current?.canFocusAndPressSpace ? [focusAndPressSpace()] : []
))

export const switchReadyActions = actions(() => (
  fixture.current === null ? [waitForSwitchFixture()] : []
))

export const switchStateIsCoherent = always(() => {
  const current = fixture.current
  if (current === null || !current.actualMounted) return true
  return current.actualChecked === current.actualCheckedState
    && current.actualTabIndex === (current.actualDisabled ? -1 : 0)
})
