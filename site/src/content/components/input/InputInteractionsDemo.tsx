import { useState } from 'preact/hooks'
import { Input, Checkbox, Button } from '@antadesign/anta'

export default function InputInteractionsDemo() {
  const [value, setValue] = useState('Keep this draft')
  const [protect, setProtect] = useState(true)
  const [event, setEvent] = useState('Edit the field or select Clear.')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '320px', maxWidth: '100%' }}>
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
    </div>
  )
}
