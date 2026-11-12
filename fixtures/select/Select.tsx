import { useLayoutEffect, useState } from 'react'
import { Select as AntaSelect } from '@antadesign/anta'

declare global {
  interface Window {
    __antaSelect?: { id: string; value: string | null; requestedDisabled: boolean; disabledOptions: string[] }
  }
}

const options = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'orange', label: 'Orange' },
]

const disabledOptions = options.filter(option => option.disabled).map(option => option.value)

export function Select({ id, disabled = false, clearable = false, defaultValue = null }: {
  id: string; disabled?: boolean; clearable?: boolean; defaultValue?: string | null
}) {
  const [value, setValue] = useState<string | null>(defaultValue)

  useLayoutEffect(() => {
    window.__antaSelect = { id, value: defaultValue, requestedDisabled: disabled, disabledOptions }
    return () => { delete window.__antaSelect }
  }, [id])

  useLayoutEffect(() => {
    window.__antaSelect!.requestedDisabled = disabled
  }, [id, disabled])

  return <section id={id}>
    <AntaSelect label="Fruit" options={options.map(option => ({ ...option, 'data-testid': `${id}-${option.value}` }))}
    placeholder="Choose a fruit" disabled={disabled} clearable={clearable}
    value={value} onValueChange={next => {
      window.__antaSelect!.value = next
      setValue(next)
    }} />
  </section>
}
