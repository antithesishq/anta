import { always } from '@antithesishq/bombadil'
import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'

export * from '@antithesishq/bombadil/browser/defaults/properties'
export { clicks } from '@antithesishq/bombadil/browser/defaults/actions'

const waitForCalendarFixture = registerCustomAction(
  'waitForCalendarFixture',
  async (document, window) => {
    const deadline = Date.now() + 5_000
    while (document.querySelectorAll('[data-fixture="calendar"] [data-fixture-target] a-calendar').length !== 5) {
      if (Date.now() >= deadline) throw new Error('Calendar fixture did not compile within five seconds.')
      await new Promise((resolve) => window.setTimeout(resolve, 25))
    }
  },
)

const focusDayAndPressKey = registerCustomAction(
  'calendarFocusDayAndPressKey',
  async (document, window, calendarIndex: number, key: string, shiftKey: boolean) => {
    const calendar = document.querySelectorAll<HTMLElement>('[data-fixture-target] a-calendar')[calendarIndex]
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

  const calendars = Array.from(root.querySelectorAll<HTMLElement & { value: string }>('[data-fixture-target] a-calendar'), (calendar) => {
    const days = Array.from(calendar.querySelectorAll<HTMLElement>('[data-part="day-cell"]'), (day) => ({
        date: day.dataset.date ?? '',
        disabled: day.hasAttribute('disabled'),
        selected: day.hasAttribute('selected'),
      }))
    return {
      days,
      disabled: calendar.hasAttribute('disabled'),
      value: calendar.value,
      valueAttribute: calendar.getAttribute('value'),
    }
  })

  return {
    calendars,
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
  if (current === null) return []
  return current.calendars.flatMap((calendar: { disabled: boolean }, calendarIndex: number) =>
    calendar.disabled ? [] : keys.map(([key, shiftKey]) => focusDayAndPressKey(calendarIndex, key, shiftKey)))
})

export const calendarReadyActions = actions(() => (
  fixture.current === null ? [waitForCalendarFixture()] : []
))

export const calendarSelectionIsCoherent = always(() => {
  const current = fixture.current
  if (current === null) return true

  return current.calendars.every((calendar: {
    days: Array<{ date: string; selected: boolean }>
    value: string
    valueAttribute: string | null
  }) => {
    const selected = calendar.days.filter((day) => day.selected)
    const selectedDateIsRendered = calendar.days.some((day) => day.date === calendar.value)
    return calendar.valueAttribute !== null
      && calendar.value === calendar.valueAttribute
      && selected.length === (selectedDateIsRendered ? 1 : 0)
      && selected.every((day) => day.date === calendar.value)
  })
})

export const disabledCalendarHasNoEnabledDays = always(() => {
  const current = fixture.current
  if (current === null) return true
  return current.calendars.every((calendar: { days: Array<{ disabled: boolean }>; disabled: boolean }) =>
    !calendar.disabled || calendar.days.every((day) => day.disabled))
})
