import { useEffect, useState } from 'preact/hooks'
import { Button, Dialog, Form, Input, Select, Text, Title } from '@antadesign/anta'

/**
 * Hydrated island for the Form docs: a Form in a Dialog, submitted by a
 * footer Button that names the form. The footer renders outside the form, so
 * the Button's `form` prop is the only link between them.
 */
export default function FormDialogPreview() {
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create API key</Button>
      {created && <Text>Created {created}.</Text>}
      <Dialog
        open={open}
        onStateChange={(_e, { next }) => setOpen(next)}
        header={<Title level={4}>Create API key</Title>}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="create-key" priority="primary">Create key</Button>
          </>
        }
      >
        <Form
          id="create-key"
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault()
            setCreated(String(new FormData(event.currentTarget as HTMLFormElement).get('name')))
            setOpen(false)
          }}
        >
          <Input name="name" label="Name" required placeholder="key_xxxxxxxx" hint="Change it to something recognizable, like where the key is used." />
          <Select
            name="expiration"
            label="Expiration"
            defaultValue="1y"
            options={[
              { value: '30d', label: '30 days' },
              { value: '90d', label: '90 days' },
              { value: '1y', label: '1 year' },
            ]}
          />
        </Form>
      </Dialog>
    </>
  )
}
