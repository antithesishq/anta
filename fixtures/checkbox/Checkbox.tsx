import { useLayoutEffect, useState } from 'react'
import { Checkbox as AntaCheckbox, type CheckboxValue } from '@antadesign/anta'

declare global {
  interface Window {
    __antaCheckbox?: { id: string; value: CheckboxValue; changes: number }
  }
}

export type CheckboxProps = {
  id: string
  defaultChecked?: CheckboxValue
  disabled?: boolean
}

export function Checkbox({ id, defaultChecked = false, disabled = false }: CheckboxProps) {
  const [checked, setChecked] = useState<CheckboxValue>(defaultChecked)

  useLayoutEffect(() => {
    window.__antaCheckbox = { id, value: defaultChecked, changes: 0 }
    return () => { delete window.__antaCheckbox }
  }, [id])

  return <AntaCheckbox name={id}
      id={id}
      label="Receive updates"
      checked={checked}
      disabled={disabled}
      onStateChange={(_event, { next }) => {
        window.__antaCheckbox!.value = next
        window.__antaCheckbox!.changes += 1
        setChecked(next)
      }}
    />
}
