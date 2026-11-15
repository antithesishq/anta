import { useLayoutEffect, useState } from 'react'
import { Dialog as AntaDialog, Button } from '@antadesign/anta'

declare global {
  interface Window {
    __antaDialog?: { id: string; open: boolean; closable: boolean; requestedPersistent: boolean }
  }
}

export function Dialog({ id, persistent = false, closable = true }: {
  id: string; persistent?: boolean; closable?: boolean
}) {
  const [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    window.__antaDialog = { id, open: false, closable, requestedPersistent: persistent }
    return () => { delete window.__antaDialog }
  }, [id])

  useLayoutEffect(() => {
    window.__antaDialog!.closable = closable
    window.__antaDialog!.requestedPersistent = persistent
  }, [id, closable, persistent])

  function updateOpen(next: boolean) {
    window.__antaDialog!.open = next
    setOpen(next)
  }

  return <section id={id}>
    <Button label="Open dialog" onClick={() => updateOpen(true)} />
    <AntaDialog header="Confirm action" open={open} persistent={persistent} closable={closable}
      onStateChange={(_event, { next }) => updateOpen(next)}
      footer={<Button label="Done" onClick={() => updateOpen(false)} />}>
      <p>AntaDialog content</p>
    </AntaDialog>
  </section>
}
