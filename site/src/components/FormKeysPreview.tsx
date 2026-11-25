import { useEffect, useState } from 'preact/hooks'
import { Button, Form, Input, Text } from '@antadesign/anta'

/**
 * Hydrated island for the Form docs: shows each submit, so pressing
 * Ctrl/Cmd+Enter in a field has a visible result.
 */
export default function FormKeysPreview() {
  const [saved, setSaved] = useState(0)
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  return (
    <>
      <Form
        submitHotkey="mod+enter"
        style={{ inlineSize: '520px', maxInlineSize: '100%' }}
        onSubmit={(event: SubmitEvent) => {
          event.preventDefault()
          setSaved(count => count + 1)
        }}
      >
        <Input name="name" label="Name" defaultValue="ci-runner" />
        <Input name="notes" label="Notes (optional)" multiline rows={2} />
        <Button type="submit" priority="primary" label="Save" />
      </Form>
      {saved > 0 && <Text>Saved {saved} {saved === 1 ? 'time' : 'times'}.</Text>}
    </>
  )
}
