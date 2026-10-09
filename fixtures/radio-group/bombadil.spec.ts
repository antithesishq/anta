import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForRadioGroupFixture = registerCustomAction(
  'waitForRadioGroupFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (document.querySelectorAll('[data-fixture="radio-group"] [data-fixture-target]').length !== 5) {
      if (Date.now() >= deadline) throw new Error('RadioGroup fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const focusAndPressKey = registerCustomAction(
  'radioGroupFocusAndPressKey',
  async (document, window, groupIndex: number, optionIndex: number, key: string) => {
    const group = document.querySelectorAll<HTMLElement>('[data-fixture-target]')[groupIndex]
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
  async (document, window, groupIndex: number, optionIndex: number, key: string, count: number) => {
    const group = document.querySelectorAll<HTMLElement>('[data-fixture-target]')[groupIndex]
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

  const groups = Array.from(root.querySelectorAll<HTMLElement & { value: string | null }>('[data-fixture-target]'), (group) => {
    const radios = Array.from(group.querySelectorAll<HTMLElement & { selected: boolean }>('a-radio'), (radio) => ({
        disabled: radio.hasAttribute('disabled'),
        selected: radio.selected,
        selectedState: radio.matches(':state(selected)'),
        tabIndex: radio.tabIndex,
        value: radio.getAttribute('value') ?? '',
      }))
    return {
      disabled: group.hasAttribute('disabled'),
      optionIndexes: radios.map((_radio, index) => index),
      radios,
      value: group.value,
    }
  })

  return {
    groups,
  }
})

const navigationKeys = [' ', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

export const radioGroupKeyboardActions = actions(() => {
  const current = fixture.current
  if (current === null) return []
  return current.groups.flatMap((group: { disabled: boolean; optionIndexes: number[] }, groupIndex: number) =>
    group.disabled ? [] : group.optionIndexes.flatMap((optionIndex) =>
      navigationKeys.map((key) => focusAndPressKey(groupIndex, optionIndex, key))))
})

export const radioGroupRapidKeyboardActions = actions(() => {
  const current = fixture.current
  if (current === null) return []
  return current.groups.flatMap((group: { disabled: boolean; optionIndexes: number[] }, groupIndex: number) =>
    group.disabled ? [] : group.optionIndexes.flatMap((optionIndex) =>
      ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].flatMap((key) =>
        [2, 3, 5].map((count) => rapidlyPressArrow(groupIndex, optionIndex, key, count)))))
})

export const radioGroupReadyActions = actions(() => (
  fixture.current === null ? [waitForRadioGroupFixture()] : []
))

export const radioGroupSelectionIsCoherent = always(() => {
  const current = fixture.current
  if (current === null) return true

  return current.groups.every((group: {
    disabled: boolean
    radios: Array<{ disabled: boolean; selected: boolean; selectedState: boolean; tabIndex: number; value: string }>
    value: string | null
  }) => {
    const matchingOption = group.radios.find((radio) => radio.value === group.value)
    const selected = group.radios.filter((radio) => radio.selected)
    const selectedStates = group.radios.filter((radio) => radio.selectedState)
    const expectedSelectedCount = matchingOption ? 1 : 0
    const tabStops = group.radios.filter((radio) => radio.tabIndex === 0)
    const expectedTabStop = group.disabled
      ? undefined
      : matchingOption ?? group.radios.find((radio) => !radio.disabled)

    return selected.length === expectedSelectedCount
      && selectedStates.length === expectedSelectedCount
      && selected.every((radio) => radio.value === group.value)
      && selectedStates.every((radio) => radio.value === group.value)
      && tabStops.length === (expectedTabStop ? 1 : 0)
      && tabStops.every((radio) => radio.value === expectedTabStop?.value)
  })
})
