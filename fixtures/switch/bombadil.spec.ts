import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import { fixtureResourceProperties } from '../resource-properties.ts'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForSwitchFixture = registerCustomAction(
  'waitForSwitchFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (document.querySelectorAll('[data-fixture="switch"] [data-fixture-target]').length !== 5) {
      if (Date.now() >= deadline) throw new Error('Switch fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const focusAndPressSpace = registerCustomAction(
  'switchFocusAndPressSpace',
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
  const root = state.document.querySelector<HTMLElement>('[data-fixture="switch"]')
  if (!root) return null

  const targets = Array.from(root.querySelectorAll<HTMLElement & { checked: boolean }>('[data-fixture-target]'), (target) => ({
    checked: target.checked,
    checkedState: target.matches(':state(checked)'),
    disabled: target.hasAttribute('disabled'),
    tabIndex: target.tabIndex,
  }))
  return {
    targets,
  }
})

export const switchKeyboardActions = actions(() => (
  fixture.current?.targets.flatMap((target: { disabled: boolean }, targetIndex: number) =>
    target.disabled ? [] : [focusAndPressSpace(targetIndex)]) ?? []
))

export const switchReadyActions = actions(() => (
  fixture.current === null ? [waitForSwitchFixture()] : []
))

export const switchStateIsCoherent = always(() => {
  const current = fixture.current
  if (current === null) return true
  return current.targets.every((target: { checked: boolean; checkedState: boolean; disabled: boolean; tabIndex: number }) =>
    target.checked === target.checkedState
      && target.tabIndex === (target.disabled ? -1 : 0))
})

const switchResources = fixtureResourceProperties({
  mountedCount: 5,
  mountedSelector: '[data-fixture="switch"] [data-fixture-target]',
})

export const switchHasNoDomNodeLeak = switchResources.noDomNodeLeak
export const switchHasNoEventListenerLeak = switchResources.noEventListenerLeak
export const switchHasNoHeapGrowth = switchResources.noHeapGrowth
export const switchHasNoLayoutObjectLeak = switchResources.noLayoutObjectLeak
