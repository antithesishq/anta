export default `import { useState } from 'preact/hooks'
import { Input, Checkbox, Button } from '@antadesign/anta'

function Demo() {
  const [value, setValue] = useState('Keep this draft')
  const [protect, setProtect] = useState(true)
  const [event, setEvent] = useState('Edit the field or select Clear.')
  return (
    <>
      <Input
        label="Draft"
        value={value}
        clearable
        hint={event}
        onValueChange={(event, { value }) => {
          setValue(value)
          setEvent(event.type === 'input' ? 'Draft updated.' : 'Draft committed.')
        }}
        onClearClick={event => {
          if (protect) {
            event.preventDefault()
            setEvent('Clear cancelled. Turn off Protect draft to clear it.')
          }
        }}
        onClearInput={() => setEvent('Draft cleared.')}
      />
      <Checkbox label="Protect draft" checked={protect}
        onStateChange={(_, { next }) => setProtect(next)} />
      <Button label="Restore draft" onClick={() => setValue('Keep this draft')} />
    </>
  )
}
`
