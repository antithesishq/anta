import { useLayoutEffect, useState } from 'react'
import { Calendar as AntaCalendar } from '@antadesign/anta'
import { InputDate } from './InputDate'

declare global {
  interface Window {
    __antaCalendar?: { id: string; value: string; changes: number; requestedDisabled: boolean; min: string; max: string }
  }
}

const min = '2026-06-05'
const max = '2026-08-25'

export function Calendar({ id, disabled = false, defaultValue = '2026-06-15', locale = 'en-US' }: {
  id: string; disabled?: boolean; defaultValue?: string; locale?: 'en-US' | 'en-GB'
}) {
  const [value, setValue] = useState(defaultValue)

  useLayoutEffect(() => {
    window.__antaCalendar = { id, value: defaultValue, changes: 0, requestedDisabled: disabled, min, max }
    return () => { delete window.__antaCalendar }
  }, [id])

  useLayoutEffect(() => {
    window.__antaCalendar!.requestedDisabled = disabled
  }, [id, disabled])

  return <><AntaCalendar id={id} name={id} aria-label="Appointment date" locale={locale}
    min={min} max={max} disabled={disabled} value={value}
    onStateChange={(_event, { next }) => {
      window.__antaCalendar!.value = next!
      window.__antaCalendar!.changes += 1
      setValue(next!)
    }} />
    <InputDate id={`${id}-input-date`} disabled={disabled} locale={locale} />
  </>
}
