import { always, next } from '@antithesishq/bombadil'
import { extract } from '@antithesishq/bombadil/browser'
import { lastAction } from '@antithesishq/bombadil/browser/defaults/actions'
import type {} from './Calendar'
import type {} from './InputDate'

const calendar = extract(state => {
  const record = state.window.__antaCalendar
  if (!record) return null
  const root = state.document.getElementById(record.id)!
  const grid = root.querySelector('a-calendar')! as HTMLElement & { value: string }
  return {
    ...record,
    focusedDate: grid.contains(state.document.activeElement)
      ? state.document.activeElement?.getAttribute('data-date') ?? null : null,
    attributeValue: grid.getAttribute('state'),
    elementValue: grid.value,
    renderedDisabled: grid.hasAttribute('disabled'),
    month: root.querySelector('[data-part="heading"]')!.textContent,
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
    days: Array.from(grid.querySelectorAll('[data-part="day-cell"]'), day => {
      const rect = day.getBoundingClientRect()
      const date = day.getAttribute('data-date')!
      return {
        date,
        expectedDisabled: record.requestedDisabled || date < record.min || date > record.max,
        selected: day.hasAttribute('selected'),
        disabled: day.hasAttribute('disabled'),
        hittable: day.contains(state.document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)),
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      }
    }),
  }
})

export const calendarDisabledPropMatchesDOM = always(() => {
  const current = calendar.current
  return !current || (current.requestedDisabled === current.renderedDisabled
    && current.days.every(day => day.disabled === day.expectedDisabled))
})

export const calendarDisabledPreservesVisibleMonth = always(() => {
  const before = calendar.current
  if (!before?.requestedDisabled) return true
  return next(() => {
    const after = calendar.current
    return after?.id !== before.id || after.month === before.month
  })
})

export const calendarSelectionMatchesState = always(() => {
  const current = calendar.current
  return !current || (current.value === current.attributeValue && current.value === current.elementValue
    && current.days.every(day => day.selected === (day.date === current.value)))
})

export const calendarSelectionStaysInRange = always(() => {
  const current = calendar.current
  return !current || (current.value >= current.min && current.value <= current.max)
})

export const calendarDisabledDoesNotChange = always(() => {
  const before = calendar.current
  if (!before?.requestedDisabled) return true
  return next(() => {
    const after = calendar.current
    return after?.id !== before.id
      || (after.value === before.value && after.changes === before.changes)
  })
})

export const calendarDayClickSelectsOnce = always(() => {
  const before = calendar.current
  if (!before) return true
  return next(() => {
    const after = calendar.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object' || !('Click' in action)
      || action.Click.fingerprint.tag !== 'a-button') return true
    const { x, y } = action.Click.point
    const day = before.days.find(day => x >= day.left && x <= day.right && y >= day.top && y <= day.bottom)
    if (!day || !day.hittable) return true
    const changes = !before.modalOpen && !day.expectedDisabled && day.date !== before.value ? 1 : 0
    return after.value === (changes ? day.date : before.value)
      && after.changes === before.changes + changes
  })
})

export const calendarNavigationPreservesSelection = always(() => {
  const before = calendar.current
  if (!before) return true
  return next(() => {
    const after = calendar.current
    if (after?.id !== before.id) return true
    const action = lastAction.current
    if (!action || typeof action !== 'object') return true
    if ('Click' in action) {
      const { x, y } = action.Click.point
      if (action.Click.fingerprint.tag === 'a-button'
        && before.days.some(day => day.hittable && x >= day.left && x <= day.right && y >= day.top && y <= day.bottom)) return true
    } else if (!('ScrollUp' in action || 'ScrollDown' in action || 'Custom' in action)) return true
    return after.value === before.value && after.changes === before.changes
  })
})

const inputDate = extract(state => {
  const record = state.window.__antaCalendarInputDate
  if (!record) return null
  const host = state.document.getElementById(record.id)!
  const control = host.shadowRoot!.querySelector('input')!
  const picker = host.nextElementSibling! as HTMLElement & { isOpen: boolean }
  const active = state.document.activeElement
  const [year, month, day] = record.value.split('-')
  return {
    ...record,
    renderedDisabled: host.hasAttribute('disabled'),
    nativeDisabled: control.disabled,
    text: control.value,
    open: picker.isOpen,
    pickerValue: picker.querySelector('a-calendar')?.getAttribute('state') ?? null,
    modalOpen: !!state.document.querySelector('a-dialog[state="open"]'),
    fieldFocused: host.shadowRoot!.activeElement === control,
    focusedDate: picker.contains(active) ? active?.getAttribute('data-date') ?? null : null,
    expectedText: !record.value ? '' : (record.locale === 'en-US' ? [month, day, year] : [day, month, year]).join('/'),
  }
})

export const inputDateDisabledPropMatchesDOM = always(() => {
  const current = inputDate.current
  return !current || (current.requestedDisabled === current.renderedDisabled
    && current.renderedDisabled === current.nativeDisabled)
})

export const inputDateLocalePreservesDisplayAndValue = always(() => {
  const before = inputDate.current
  if (!before || before.text !== before.expectedText) return true
  return next(() => {
    const after = inputDate.current
    return after?.id !== before.id || after.locale === before.locale
      || (after.value === before.value && after.text === after.expectedText)
  })
})

function adjacentDate(iso: string, offset: number) {
  const date = new Date(iso)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export const calendarKeyboardMovesFocusOrSelects = always(() => {
  const before = calendar.current
  if (!before?.focusedDate || before.requestedDisabled || before.modalOpen) return true
  const focusedDate = before.focusedDate
  return next(() => {
    const after = calendar.current
    const action = lastAction.current
    if (after?.id !== before.id || !action || typeof action !== 'object' || !('PressKey' in action)) return true
    const key = action.PressKey.code
    if (key === 13 || key === 32) {
      const changes = focusedDate === before.value ? 0 : 1
      return after.value === focusedDate && after.changes === before.changes + changes
    }
    if (key !== 37 && key !== 39) return true
    const iso = adjacentDate(focusedDate, key === 37 ? -1 : 1)
    const expected = iso < before.min ? before.min : iso > before.max ? before.max : iso
    return after.focusedDate === expected && after.value === before.value && after.changes === before.changes
  })
})

export const inputDateKeyboardOpensAndSelects = always(() => {
  const before = inputDate.current
  if (!before || before.requestedDisabled || before.modalOpen) return true
  return next(() => {
    const after = inputDate.current
    const action = lastAction.current
    if (after?.id !== before.id || !action || typeof action !== 'object' || !('PressKey' in action)) return true
    const key = action.PressKey.code
    if (!before.open && before.fieldFocused && before.text === before.expectedText && (key === 38 || key === 40)) {
      return after.open && after.value === before.value
    }
    if (!before.open || !before.focusedDate) return true
    if (key === 13 || key === 32) {
      if (before.focusedDate === before.pickerValue) return after.open && after.value === before.value
      return !after.open && after.value === before.focusedDate
    }
    if (key === 27) return !after.open && after.value === before.value
    if (key === 37 || key === 39) {
      return after.open && after.focusedDate === adjacentDate(before.focusedDate, key === 37 ? -1 : 1)
        && after.value === before.value
    }
    return true
  })
})
