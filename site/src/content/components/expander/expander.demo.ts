export default `import { Expander, Text } from '@antadesign/anta'

function Demo() {
  return (
    <Expander title="What is automated testing?" defaultOpen>
      <Text>Automated testing runs checks against your software and reports failures you can investigate and reproduce.</Text>
    </Expander>
  )
}
`

export const actionsDemo = `import { Expander, Button, Text, Title, Icon } from '@antadesign/anta'
import { useState } from 'preact/hooks'

function Demo() {
  const [downloads, setDownloads] = useState(0)
  return (
    <Expander
      title={<Title level={4}>Build artifacts</Title>}
      indicatorPlacement="end"
      indicator={{ closed: <Icon shape="plus" />, open: <Icon shape="minus" /> }}
      actions={<Button size="small" label="Download" onClick={() => setDownloads(count => count + 1)} />}
    >
      <Text>Download requests: {downloads}. The action leaves the disclosure state unchanged.</Text>
    </Expander>
  )
}
`

export const stateDemo = `import { Expander, Button, Checkbox, Text } from '@antadesign/anta'
import { useState } from 'preact/hooks'

function Demo() {
  const [open, setOpen] = useState(false)
  const [accept, setAccept] = useState(true)
  const [requests, setRequests] = useState(0)
  return (
    <div style={{ display: 'grid', gap: 12, width: '100%' }}>
      <Checkbox checked={accept} onStateChange={(_, { next }) => setAccept(next === true)}>Accept state requests</Checkbox>
      <Expander title="Release details" open={open} onStateChange={(_, { next }) => {
        setRequests(count => count + 1)
        if (accept) setOpen(next)
      }}>
        <Text>The content stays mounted when closed.</Text>
      </Expander>
      <Text>State requests: {requests}</Text>
      <Button label="Show details" onClick={() => setOpen(true)} />
    </div>
  )
}
`

export const vetoDemo = `import { Expander, Checkbox, Text } from '@antadesign/anta'
import { useState } from 'preact/hooks'

function Demo() {
  const [keepOpen, setKeepOpen] = useState(true)
  return (
    <div style={{ display: 'grid', gap: 12, width: '100%' }}>
      <Checkbox checked={keepOpen} onStateChange={(_, { next }) => setKeepOpen(next === true)}>Keep details open</Checkbox>
      <Expander title="Unsaved changes" defaultOpen onStateChange={(event, { next }) => {
        if (!next && keepOpen) event.preventDefault()
      }}>
        <Text>Clear the checkbox to allow this section to close.</Text>
      </Expander>
    </div>
  )
}
`
