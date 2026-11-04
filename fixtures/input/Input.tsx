import { useLayoutEffect, useState } from 'react'
import { Input as AntaInput } from '@antadesign/anta'

declare global {
  interface Window {
    __antaInput?: { id: string; value: string }
  }
}

export function Input({ id, disabled = false, readOnly = false, clearable = false }: {
  id: string; disabled?: boolean; readOnly?: boolean; clearable?: boolean
}) {
  const [value, setValue] = useState('')

  useLayoutEffect(() => {
    window.__antaInput = { id, value: '' }
    return () => { delete window.__antaInput }
  }, [id])

  return <AntaInput id={id} name={id} label="Name" placeholder="Enter your name" disabled={disabled}
    readOnly={readOnly} clearable={clearable} value={value}
    onValueChange={(_event, { value }) => {
      window.__antaInput!.value = value
      setValue(value)
    }} />
}
