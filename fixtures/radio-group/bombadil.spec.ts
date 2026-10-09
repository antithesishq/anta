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
    if (!group || !radio || group.hasAttribute('disabled')) return
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

const rapidlyPressArrow = registerCustomAction(
  'radioGroupRapidlyPressArrow',
  async (document, window, optionIndex: number, key: string, count: number) => {
    const group = document.querySelector<HTMLElement>('[data-fixture-target]')
    let radio = group?.querySelectorAll<HTMLElement>('a-radio')[optionIndex]
    if (!group || !radio || group.hasAttribute('disabled')) return
    const browser = window as unknown as typeof globalThis

    radio.focus()
    for (let index = 0; index < count; index += 1) {
      const focused = document.activeElement?.closest?.('a-radio') as HTMLElement | null
      if (focused && group.contains(focused)) radio = focused
      radio.dispatchEvent(new browser.KeyboardEvent('keydown', {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
      }))
      radio.dispatchEvent(new browser.KeyboardEvent('keyup', {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
      }))
    }
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
        tabIndex: radio.tabIndex,
        value: radio.getAttribute('value') ?? '',
      }))
    : []

  return {
    actualDisabled: group?.hasAttribute('disabled') ?? null,
    actualMounted: group !== null,
    actualValue: group?.value ?? null,
    optionIndexes: radios.map((_radio, index) => index),
    radios,
  }
})

const navigationKeys = [' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

export const radioGroupKeyboardActions = actions(() => {
  const current = fixture.current
  if (current === null || !current.actualMounted || current.actualDisabled) return []
  return current.optionIndexes.flatMap((optionIndex: number) =>
    navigationKeys.map((key) => focusAndPressKey(optionIndex, key)))
})

export const radioGroupRapidKeyboardActions = actions(() => {
  const current = fixture.current
  if (current === null || !current.actualMounted || current.actualDisabled) return []
  return current.optionIndexes.flatMap((optionIndex: number) =>
    ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].flatMap((key) =>
      [2, 3, 5].map((count) => rapidlyPressArrow(optionIndex, key, count))))
})

export const radioGroupReadyActions = actions(() => (
  fixture.current === null ? [waitForRadioGroupFixture()] : []
))

export const radioGroupSelectionIsCoherent = always(() => {
  const current = fixture.current
  if (current === null || !current.actualMounted) return true

  const matchingOption = current.radios.find((radio: { value: string }) => radio.value === current.actualValue)
  const selected = current.radios.filter((radio: { selected: boolean }) => radio.selected)
  const selectedStates = current.radios.filter((radio: { selectedState: boolean }) => radio.selectedState)
  const expectedSelectedCount = matchingOption ? 1 : 0
  const tabStops = current.radios.filter((radio: { tabIndex: number }) => radio.tabIndex === 0)
  const expectedTabStop = current.actualDisabled
    ? undefined
    : matchingOption ?? current.radios.find((radio: { disabled: boolean }) => !radio.disabled)

  return selected.length === expectedSelectedCount
    && selectedStates.length === expectedSelectedCount
    && selected.every((radio: { value: string }) => radio.value === current.actualValue)
    && selectedStates.every((radio: { value: string }) => radio.value === current.actualValue)
    && tabStops.length === (expectedTabStop ? 1 : 0)
    && tabStops.every((radio: { value: string }) => radio.value === expectedTabStop?.value)
})
