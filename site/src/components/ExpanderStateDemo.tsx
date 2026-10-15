import { useState } from 'preact/hooks'
import { Box, Button, Checkbox, Expander, Text } from '@antadesign/anta'

export function CancelableExpanderDemo() {
  const [keepOpen, setKeepOpen] = useState(true)
  return (
    <Box display="grid" gap={12} style={{ width: '100%' }}>
      <Checkbox checked={keepOpen} onStateChange={(_, { next }) => setKeepOpen(next === true)}>Keep details open</Checkbox>
      <Expander title="Unsaved changes" defaultOpen onStateChange={(event, { next }) => {
        if (!next && keepOpen) event.preventDefault()
      }}>
        <Text>Clear the checkbox to allow this section to close.</Text>
      </Expander>
    </Box>
  )
}

export function ControlledExpanderDemo() {
  const [open, setOpen] = useState(false)
  const [accept, setAccept] = useState(true)
  const [requests, setRequests] = useState(0)
  return (
    <Box display="grid" gap={12} style={{ width: '100%' }}>
      <Checkbox checked={accept} onStateChange={(_, { next }) => setAccept(next === true)}>Accept state requests</Checkbox>
      <Expander title="Release details" open={open} onStateChange={(_, { next }) => {
        setRequests(count => count + 1)
        if (accept) setOpen(next)
      }}>
        <Text>The content stays mounted when closed.</Text>
      </Expander>
      <Text>State requests: {requests}</Text>
      <Button label="Show details" onClick={() => setOpen(true)} />
    </Box>
  )
}
