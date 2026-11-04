import { useLayoutEffect, useState } from 'react'
import { InputDate as AntaInputDate } from '@antadesign/anta'

declare global {
  interface Window {
    __antaCalendarInputDate?: { id: string; value: string; locale: string }
  }
}

export function InputDate({ id, disabled, locale }: {
  id: string; disabled: boolean; locale: 'en-US' | 'en-GB'
}) {
  const [record] = useState(() => ({ id, value: '2026-07-04', locale }))

  useLayoutEffect(() => {
    window.__antaCalendarInputDate = record
    return () => { delete window.__antaCalendarInputDate }
  }, [record])
  useLayoutEffect(() => { record.locale = locale }, [locale, record])

  return <AntaInputDate id={id} name={id} data-fixture-submission-name={id} label="Date entry" defaultValue="2026-07-04"
    disabled={disabled} locale={locale} onValueChange={value => { record.value = value }} />
}
