import { actions, extract, registerCustomAction } from '@antithesishq/bombadil/browser'
import type {} from './Calendar'
import type {} from './InputDate'

const targets = extract(state => {
  if (state.document.querySelector('a-dialog[state="open"]')) return null
  const { __antaCalendar: calendar, __antaCalendarInputDate: inputDate } = state.window
  if (!calendar || !inputDate || calendar.requestedDisabled) return null
  const grid = state.document.getElementById(calendar.id)!.querySelector('a-calendar')!
  const field = state.document.getElementById(inputDate.id)!
  const picker = field.nextElementSibling! as HTMLElement & { isOpen: boolean }
  const active = state.document.activeElement
  return {
    calendarDayFocused: !!active?.matches('[data-part="day-cell"]') && grid.contains(active),
    pickerDayFocused: !!active?.matches('[data-part="day-cell"]') && picker.contains(active),
    fieldFocused: active === field,
    pickerOpen: picker.isOpen,
  }
})

const focusCalendarDay = registerCustomAction('focusCalendarDay', async (document, window) => {
  document.getElementById(window.__antaCalendar!.id)!
    .querySelector<HTMLElement>('a-calendar [data-part="day-cell"][tabindex="0"]')?.focus()
})
const focusInputDate = registerCustomAction('focusInputDate', async (document, window) => {
  document.getElementById(window.__antaCalendarInputDate!.id)!
    .shadowRoot!.querySelector('input')!.focus()
})

const focusInputDateDay = registerCustomAction('focusInputDateDay', async (document, window) => {
  document.getElementById(window.__antaCalendarInputDate!.id)!.nextElementSibling!
    .querySelector<HTMLElement>('[data-part="day-cell"][tabindex="0"]')?.focus()
})

export const calendarKeyboard = actions(() => {
  const current = targets.current
  if (!current) return []
  return current.calendarDayFocused
    ? [37, 39, 13].map(code => ({ PressKey: { code } }))
    : [focusCalendarDay()]
})

export const inputDateKeyboard = actions(() => {
  const current = targets.current
  if (!current) return []
  if (current.pickerDayFocused) return [13, 27, 39].map(code => ({ PressKey: { code } }))
  if (current.pickerOpen) return [focusInputDateDay()]
  return current.fieldFocused ? [{ PressKey: { code: 40 } }] : [focusInputDate()]
})
