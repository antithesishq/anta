import { useLayoutEffect, useState } from 'react'
import { Calendar as AntaCalendar } from '@antadesign/anta'
import { InputDate } from './InputDate'

declare global {
  interface Window {
    __antaCalendar?: { id: string; value: string; changes: number }
  }
}

export function Calendar({ id, disabled = false, defaultValue = '2026-06-15', locale = 'en-US' }: {
  id: string; disabled?: boolean; defaultValue?: string; locale?: 'en-US' | 'en-GB'
}) {
  const [value, setValue] = useState(defaultValue)

  useLayoutEffect(() => {
    window.__antaCalendar = { id, value: defaultValue, changes: 0 }
    return () => { delete window.__antaCalendar }
  }, [id])

  return <><AntaCalendar id={id} name={id} aria-label="Appointment date" locale={locale}
    min="2026-06-05" max="2026-08-25" disabled={disabled} value={value}
    onStateChange={(_event, { next }) => {
      window.__antaCalendar!.value = next!
      window.__antaCalendar!.changes += 1
      setValue(next!)
    }} />
    <InputDate id={`${id}-input-date`} disabled={disabled} locale={locale} />
  </>
}
