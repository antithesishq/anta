import { useLayoutEffect, useState } from 'react'
import { Slider as AntaSlider } from '@antadesign/anta'

declare global {
  interface Window {
    __antaSlider?: { id: string; value: number; changes: number; requestedDisabled: boolean }
  }
}

export function Slider({ id, min = 0, max = 100, step = 5, disabled = false }: {
  id: string; min?: number; max?: number; step?: number; disabled?: boolean
}) {
  const [value, setValue] = useState(() => min)

  useLayoutEffect(() => {
    window.__antaSlider = { id, value: min, changes: 0, requestedDisabled: disabled }
    return () => { delete window.__antaSlider }
  }, [id])

  useLayoutEffect(() => {
    window.__antaSlider!.requestedDisabled = disabled
  }, [id, disabled])

  return <AntaSlider id={id} name={id} label="Volume" min={min} max={max} step={step} disabled={disabled}
    value={value}
    onValueChange={(_event, { value }) => {
      const next = value as number
      window.__antaSlider!.value = next
      window.__antaSlider!.changes += 1
      setValue(next)
    }} />
}
