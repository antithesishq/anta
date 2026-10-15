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
