import { Calendar, InputDate, type CalendarProps } from '@antadesign/anta'

const controlled: CalendarProps = { value: null }
const uncontrolled: CalendarProps = { defaultValue: null }
Calendar(controlled)
Calendar(uncontrolled)
Calendar({ value: undefined, defaultValue: '2026-10-08' })
Calendar({ value: '' })

;<Calendar value={null} defaultValue={null} onValueChange={(_event, attrs) => {
  const date: string | null = attrs.value
  date?.toLowerCase()
  // @ts-expect-error An empty Calendar reports null, rather than only a string.
  attrs.value.toLowerCase()
  // @ts-expect-error Date callbacks must retain their string/null type.
  const numeric: number | null = attrs.value
  void numeric
}} onStateChange={(_event, detail) => {
  const next: string | null = detail.next
  const prev: string | null = detail.prev
  void [next, prev]
}} />
;<Calendar defaultValue={null} />

// @ts-expect-error Dates do not accept numeric values.
Calendar({ value: 25 })
// @ts-expect-error A default is a single date or null, rather than an array.
Calendar({ defaultValue: ['2026-10-08'] })
// @ts-expect-error InputDate retains its string-valued text-field contract.
InputDate({ value: null })
