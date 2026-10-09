import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForRadioGroupFixture = registerCustomAction(
  'waitForRadioGroupFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (!document.querySelector('[data-fixture="radio-group"]')) {
      if (Date.now() >= deadline) throw new Error('RadioGroup fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const focusAndPressKey = registerCustomAction(
  'radioGroupFocusAndPressKey',
  async (document, window, optionIndex: number, key: string) => {
    const group = document.querySelector<HTMLElement>('[data-fixture-target]')
    const radio = group?.querySelectorAll<HTMLElement>('a-radio')[optionIndex]
    if (!group || !radio || group.matches(':disabled') || radio.hasAttribute('disabled')) return
    const browser = window as unknown as typeof globalThis

    radio.focus()
    radio.dispatchEvent(new browser.KeyboardEvent('keydown', {
      key,
      code: key === ' ' ? 'Space' : key,
      bubbles: true,
      cancelable: true,
    }))
    radio.dispatchEvent(new browser.KeyboardEvent('keyup', {
      key,
      code: key === ' ' ? 'Space' : key,
      bubbles: true,
      cancelable: true,
    }))
  },
)

const fixture = extract((state) => {
  const root = state.document.querySelector<HTMLElement>('[data-fixture="radio-group"]')
  if (!root) return null

  const group = root.querySelector<HTMLElement & { value: string | null }>('[data-fixture-target]')
  const radios = group
    ? Array.from(group.querySelectorAll<HTMLElement & { selected: boolean }>('a-radio'), (radio) => ({
        disabled: radio.hasAttribute('disabled'),
        selected: radio.selected,
        selectedState: radio.matches(':state(selected)'),
        value: radio.getAttribute('value') ?? '',
      }))
    : []

  return {
    actualDisabled: group?.hasAttribute('disabled') ?? null,
    actualMounted: group !== null,
    actualValue: group?.value ?? null,
    enabledOptionIndexes: radios.flatMap((radio, index) => radio.disabled ? [] : [index]),
    expectedDisabled: root.dataset.expectedDisabled === 'true',
    expectedMounted: root.dataset.expectedMounted === 'true',
    lastNext: root.dataset.lastNext ?? null,
    lastPrev: root.dataset.lastPrev ?? null,
    lastPrevMatched: root.dataset.lastPrevMatched === 'true',
    lastReason: root.dataset.lastReason ?? null,
    lastTargetEnabled: root.dataset.lastTargetEnabled === 'true',
    radios,
    requestedWhileDisabled: root.dataset.requestedWhileDisabled === 'true',
    valueWhenDisabled: root.dataset.valueWhenDisabled ?? null,
  }
})

const navigationKeys = [' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

export const radioGroupKeyboardActions = actions(() => {
  const current = fixture.current
  if (current === null || !current.actualMounted || current.expectedDisabled) return []
  return current.enabledOptionIndexes.flatMap((optionIndex: number) =>
    navigationKeys.map((key) => focusAndPressKey(optionIndex, key)))
})

export const radioGroupReadyActions = actions(() => (
  fixture.current === null ? [waitForRadioGroupFixture()] : []
))

export const radioGroupFollowsStateMachine = always(() => {
  const current = fixture.current
  if (current === null) return true
  if (current.actualMounted !== current.expectedMounted) return false
  if (!current.expectedMounted) return true
  if (current.actualDisabled !== current.expectedDisabled) return false
  if (current.lastNext === null) return true

  return current.lastReason === 'user'
    && current.lastPrev !== current.lastNext
    && current.lastPrevMatched
    && current.lastTargetEnabled
    && current.actualValue === current.lastNext
})

export const disabledRadioGroupDoesNotTransition = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted || !current.expectedDisabled) return true
  return !current.requestedWhileDisabled
    && current.valueWhenDisabled !== null
    && current.actualValue === current.valueWhenDisabled
})

export const radioGroupOptionsReconcile = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted) return true

  const matchingOptionExists = current.radios.some((radio: { value: string }) => radio.value === current.actualValue)
  const selected = current.radios.filter((radio: { selected: boolean }) => radio.selected)
  const selectedStates = current.radios.filter((radio: { selectedState: boolean }) => radio.selectedState)
  const expectedSelectedCount = matchingOptionExists ? 1 : 0

  return selected.length === expectedSelectedCount
    && selectedStates.length === expectedSelectedCount
    && selected.every((radio: { value: string }) => radio.value === current.actualValue)
    && selectedStates.every((radio: { value: string }) => radio.value === current.actualValue)
})
