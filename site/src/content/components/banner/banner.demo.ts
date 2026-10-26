// A module preserves indentation in the Playground editor.
export default `import { Banner, Button } from '@antadesign/anta'

function Demo() {
  return (
    <Banner
      tone="info"
      message="A new release is available."
      actions={<Button size="small" priority="tertiary" tone="info" label="Remind me later" data-banner-dismiss />}
    />
  )
}
`

export const dismissalDemo = `import { Banner, Button, Checkbox, Text } from '@antadesign/anta'
import { useState } from 'preact/hooks'

function Demo() {
  const [dismissed, setDismissed] = useState(false)
  const [accept, setAccept] = useState(true)
  const [requests, setRequests] = useState(0)

  return (
    <div style={{ display: 'grid', gap: 12, width: '100%' }}>
      <Checkbox checked={accept} onStateChange={(_, { next }) => setAccept(next === true)}>
        Accept dismissal requests
      </Checkbox>
      <Banner
        tone="success"
        message="Your changes were saved."
        dismissed={dismissed}
        onDismiss={() => {
          setRequests(count => count + 1)
          if (accept) setDismissed(true)
        }}
        actions={<Button size="small" tone="success" label="Got it" data-banner-dismiss />}
      />
      <Text size="small">Dismissal requests: {requests}</Text>
      <Button label="Show notice again" onClick={() => setDismissed(false)} />
    </div>
  )
}
`
