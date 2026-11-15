import { useLayoutEffect, useState } from 'react'
import { Switch as AntaSwitch } from '@antadesign/anta'

declare global {
  interface Window {
    __antaSwitch?: { id: string; value: boolean; changes: number; requestedDisabled: boolean }
  }
}

export function Switch({ id, disabled = false, defaultChecked = false }: {
  id: string; disabled?: boolean; defaultChecked?: boolean
}) {
  const [checked, setChecked] = useState(defaultChecked)

  useLayoutEffect(() => {
    window.__antaSwitch = { id, value: defaultChecked, changes: 0, requestedDisabled: disabled }
    return () => { delete window.__antaSwitch }
  }, [id])

  useLayoutEffect(() => {
    window.__antaSwitch!.requestedDisabled = disabled
  }, [id, disabled])

  return <AntaSwitch id={id} name={id} label="Notifications" disabled={disabled} checked={checked}
    onStateChange={(_event, { next }) => {
      window.__antaSwitch!.value = next
      window.__antaSwitch!.changes += 1
      setChecked(next)
    }} />
}
