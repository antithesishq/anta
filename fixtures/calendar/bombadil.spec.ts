import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForCalendarFixture = registerCustomAction(
  'waitForCalendarFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (!document.querySelector('[data-fixture="calendar"]')) {
      if (Date.now() >= deadline) throw new Error('Calendar fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const focusDayAndPressKey = registerCustomAction(
  'calendarFocusDayAndPressKey',
  async (document, window, key: string, shiftKey: boolean) => {
    const calendar = document.querySelector<HTMLElement>('[data-fixture-target] a-calendar')
    const day = calendar?.querySelector<HTMLElement>('[data-part="day-cell"][tabindex="0"]')
    if (!calendar || !day || calendar.hasAttribute('disabled') || day.hasAttribute('disabled')) return
    const browser = window as unknown as typeof globalThis

    day.focus()
    day.dispatchEvent(new browser.KeyboardEvent('keydown', {
      key,
      code: key === ' ' ? 'Space' : key,
      shiftKey,
      bubbles: true,
      cancelable: true,
    }))
    day.dispatchEvent(new browser.KeyboardEvent('keyup', {
      key,
      code: key === ' ' ? 'Space' : key,
      shiftKey,
      bubbles: true,
      cancelable: true,
    }))
  },
)

const fixture = extract((state) => {
  const root = state.document.querySelector<HTMLElement>('[data-fixture="calendar"]')
  if (!root) return null

  const calendar = root.querySelector<HTMLElement & { value: string }>('[data-fixture-target] a-calendar')
  const days = calendar
    ? Array.from(calendar.querySelectorAll<HTMLElement>('[data-part="day-cell"]'), (day) => ({
        date: day.dataset.date ?? '',
        disabled: day.hasAttribute('disabled'),
        selected: day.hasAttribute('selected'),
        tabIndex: day.tabIndex,
      }))
    : []

  return {
    actualDisabled: calendar?.hasAttribute('disabled') ?? null,
    actualMounted: calendar !== null,
    actualValue: calendar?.value ?? null,
    attributeValue: calendar?.getAttribute('value') ?? null,
    days,
    expectedDisabled: root.dataset.expectedDisabled === 'true',
    expectedMounted: root.dataset.expectedMounted === 'true',
    expectedValue: root.dataset.expectedValue ?? '',
    lastNext: root.dataset.lastNext ?? null,
    lastPreApplyConsistent: root.dataset.lastPreApplyConsistent !== 'false',
    lastPrev: root.dataset.lastPrev ?? null,
    lastReason: root.dataset.lastReason ?? null,
    max: root.dataset.max ?? '',
    min: root.dataset.min ?? '',
    requestedWhileDisabled: root.dataset.requestedWhileDisabled === 'true',
    valueWhenDisabled: root.dataset.valueWhenDisabled ?? null,
  }
})

const keys = [
  [' ', false],
  ['Enter', false],
  ['ArrowLeft', false],
  ['ArrowRight', false],
  ['ArrowUp', false],
  ['ArrowDown', false],
  ['Home', false],
  ['End', false],
  ['PageUp', false],
  ['PageDown', false],
  ['PageUp', true],
  ['PageDown', true],
] as const

export const calendarKeyboardActions = actions(() => {
  const current = fixture.current
  if (current === null || !current.actualMounted || current.expectedDisabled) return []
  return keys.map(([key, shiftKey]) => focusDayAndPressKey(key, shiftKey))
})

export const calendarReadyActions = actions(() => (
  fixture.current === null ? [waitForCalendarFixture()] : []
))

export const calendarSelectionStaysCoherent = always(() => {
  const current = fixture.current
  if (current === null) return true
  if (current.actualMounted !== current.expectedMounted) return false
  if (!current.expectedMounted) return true

  const selected = current.days.filter((day: { selected: boolean }) => day.selected)
  const selectedDateIsRendered = current.days.some((day: { date: string }) => day.date === current.expectedValue)
  return current.actualValue === current.expectedValue
    && current.attributeValue === current.expectedValue
    && selected.length === (selectedDateIsRendered ? 1 : 0)
    && selected.every((day: { date: string }) => day.date === current.expectedValue)
})

export const calendarRovingDayRespectsBounds = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted) return true
  const tabbable = current.days.filter((day: { tabIndex: number }) => day.tabIndex === 0)
  if (tabbable.length !== 1) return false

  return current.actualDisabled === current.expectedDisabled
    && current.days.every((day: { date: string; disabled: boolean }) =>
      day.disabled === (current.expectedDisabled || day.date < current.min || day.date > current.max))
})

export const calendarUserTransitionReachesControlledValue = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted || current.lastNext === null) return true
  return current.lastReason === 'user'
    && current.lastPrev !== current.lastNext
    && current.lastPreApplyConsistent
    && current.actualValue === current.lastNext
})

export const disabledCalendarDoesNotRequestSelection = always(() => {
  const current = fixture.current
  if (current === null || !current.expectedMounted || !current.expectedDisabled) return true
  return !current.requestedWhileDisabled
    && current.valueWhenDisabled !== null
    && current.actualValue === current.valueWhenDisabled
})
