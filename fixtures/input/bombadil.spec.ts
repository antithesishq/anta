import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks, inputs } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForInputFixture = registerCustomAction(
  'waitForInputFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (!document.querySelector('[data-fixture="input"]')) {
      if (Date.now() >= deadline) throw new Error('Input fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const replaceInputValue = registerCustomAction(
  'replaceInputValue',
  async (document, window, value: string) => {
    const host = document.querySelector<HTMLElement & { value: string }>('[data-fixture-target]')
    const control = host?.shadowRoot?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
    if (!host || !control || control.disabled || control.readOnly) return
    const browser = window as unknown as typeof globalThis

    control.focus()
    control.value = value
    control.dispatchEvent(new browser.Event('input', { bubbles: true, composed: true }))
  },
)

const fixture = extract((state) => {
  const root = state.document.querySelector<HTMLElement>('[data-fixture="input"]')
  if (!root) return null

  const host = root.querySelector<HTMLElement & { value: string }>('[data-fixture-target]')
  const control = host?.shadowRoot?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea') ?? null

  return {
    actualDisabled: control?.disabled ?? null,
    actualFilled: host?.matches(':state(filled)') ?? null,
    actualMounted: host !== null,
    actualReadOnly: control?.readOnly ?? null,
    actualTag: control?.tagName ?? null,
    actualValue: host?.value ?? null,
    controlValue: control?.value ?? null,
    expectedDisabled: root.dataset.expectedDisabled === 'true',
    expectedMounted: root.dataset.expectedMounted === 'true',
    expectedMultiline: root.dataset.expectedMultiline === 'true',
    expectedReadOnly: root.dataset.expectedReadonly === 'true',
    expectedValue: root.dataset.expectedValue ?? '',
    changedWhileLocked: root.dataset.changedWhileLocked === 'true',
    valueWhenLocked: root.dataset.valueWhenLocked ?? null,
  }
})

export const inputEditActions = actions(() => {
  const current = fixture.current
  if (current === null || !current.actualMounted || current.expectedDisabled || current.expectedReadOnly) return []
  return ['', 'A', 'Bombadil typed this', 'one\ntwo'].map((value) => replaceInputValue(value))
})

export const inputReadyActions = actions(() => (
  fixture.current === null ? [waitForInputFixture()] : []
))

export const inputValueAndControlStayCoherent = always(() => {
  const current = fixture.current
  if (current === null) return true
  if (current.actualMounted !== current.expectedMounted) return false
  if (!current.expectedMounted) return true

  return current.actualValue === current.expectedValue
    && current.controlValue === current.expectedValue
    && current.actualFilled === (current.expectedValue.length > 0)
    && current.actualTag === (current.expectedMultiline ? 'TEXTAREA' : 'INPUT')
})

export const inputLockStateReachesTheNativeControl = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted) return true
  return current.actualDisabled === current.expectedDisabled
    && current.actualReadOnly === current.expectedReadOnly
})

export const lockedInputRejectsUserEdits = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted || (!current.expectedDisabled && !current.expectedReadOnly)) return true
  return !current.changedWhileLocked
    && current.valueWhenLocked !== null
    && current.actualValue === current.valueWhenLocked
})
