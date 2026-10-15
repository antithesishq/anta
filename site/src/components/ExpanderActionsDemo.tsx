import { useState } from 'preact/hooks'
import { Button, Expander, Icon, Text, Title } from '@antadesign/anta'

export function ExpanderActionsDemo() {
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
