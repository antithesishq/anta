import { useLayoutEffect, useState } from 'react'
import { Expander as AntaExpander } from '@antadesign/anta'

declare global {
  interface Window {
    __antaExpander?: { id: string; open: boolean; changes: number; requestedDisabled: boolean }
  }
}

export function Expander({ id, disabled = false }: { id: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)

  useLayoutEffect(() => {
    window.__antaExpander = { id, open: false, changes: 0, requestedDisabled: disabled }
    return () => { delete window.__antaExpander }
  }, [id])

  useLayoutEffect(() => {
    window.__antaExpander!.requestedDisabled = disabled
  }, [id, disabled])

  return <AntaExpander id={id} title="More information" disabled={disabled} open={open}
    onStateChange={(_event, { next }) => {
      window.__antaExpander!.open = next
      window.__antaExpander!.changes += 1
      setOpen(next)
    }}>
    <p>Additional information</p>
  </AntaExpander>
}
