import { useLayoutEffect, useState } from 'react'
import { RadioGroup as AntaRadioGroup, type RadioOption } from '@antadesign/anta'

declare global {
  interface Window {
    __antaRadioGroup?: { id: string; value: string | null; changes: number }
  }
}

const options: RadioOption[] = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS', disabled: true },
  { value: 'push', label: 'Push notifications' },
]

export type RadioGroupProps = {
  id: string
  defaultValue?: string
  disabled?: boolean
}

export function RadioGroup({ id, defaultValue = 'email', disabled = false }: RadioGroupProps) {
  const [value, setValue] = useState<string | null>(defaultValue)

  useLayoutEffect(() => {
    window.__antaRadioGroup = { id, value: defaultValue, changes: 0 }
    return () => { delete window.__antaRadioGroup }
  }, [id])

  return <AntaRadioGroup name={id}
      id={id}
      label="Contact method"
      options={options.map(option => ({ ...option, 'data-testid': `${id}-${option.value}` }))}
      value={value ?? ''}
      disabled={disabled}
      onStateChange={(_event, { next }) => {
        window.__antaRadioGroup!.value = next
        window.__antaRadioGroup!.changes += 1
        setValue(next)
      }}
    />
}
