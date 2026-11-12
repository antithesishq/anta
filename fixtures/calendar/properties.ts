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
  const [year, month, day] = record.value.split('-')
  return {
    ...record,
    renderedDisabled: host.hasAttribute('disabled'),
    nativeDisabled: control.disabled,
    text: control.value,
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
