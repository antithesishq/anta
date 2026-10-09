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
      }))
    : []

  return {
    disabled: calendar?.hasAttribute('disabled') ?? null,
    mounted: calendar !== null,
    value: calendar?.value ?? null,
    valueAttribute: calendar?.getAttribute('value') ?? null,
    days,
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
  if (current === null || !current.mounted || current.disabled) return []
  return keys.map(([key, shiftKey]) => focusDayAndPressKey(key, shiftKey))
})

export const calendarReadyActions = actions(() => (
  fixture.current === null ? [waitForCalendarFixture()] : []
))

export const calendarSelectionIsCoherent = always(() => {
  const current = fixture.current
  if (current === null || !current.mounted) return true

  const selected = current.days.filter((day: { selected: boolean }) => day.selected)
  const selectedDateIsRendered = current.days.some((day: { date: string }) => day.date === current.value)
  return current.valueAttribute !== null
    && current.value === current.valueAttribute
    && selected.length === (selectedDateIsRendered ? 1 : 0)
    && selected.every((day: { date: string }) => day.date === current.value)
})

export const disabledCalendarHasNoEnabledDays = always(() => {
  const current = fixture.current
  if (current === null || !current.mounted || !current.disabled) return true
  return current.days.every((day: { disabled: boolean }) => day.disabled)
})
