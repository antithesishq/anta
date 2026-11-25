# Form

`Form` aligns field labels in a native HTML form. When space is tight, the labels move above the controls.

## Label and field

The setup form adapts to the space available in its container.

**Set to 500px wide**

**Set to 280px wide**

```tsx
<Form>
  <Input name="image" label="Config image" multiline rows={2} hint="An image with the orchestration and config files for your software." />
  <Input name="hours" label="Max compute hours" defaultValue="16" hint="Compute hours for the run, setup included." />
  <Checkbox name="setup" label="Setup mode" />
  <Button type="submit" priority="primary" label="Launch the setup run" />
</Form>
```

Place fields directly inside `Form` to align them. An `Input`, `InputTime`, or `RadioGroup` can share a label column. Checkboxes, switches, sliders, and buttons line up with the controls. Fields inside a `<fieldset>` or `<div>` keep their own layout.

For a group of radio buttons, give the group a label such as **Session duration**.

```tsx
<Form>
  <RadioGroup
    name="duration"
    label="Session duration"
    defaultValue="short"
    options={[
      { value: 'short', label: 'Short: 1 hour, up to 48 compute hours' },
      { value: 'medium', label: 'Medium: 3 hours, up to 144 compute hours' },
      { value: 'long', label: 'Long: 6 hours, up to 288 compute hours' },
    ]}
  />
  <Input name="description" label="Session description" multiline rows={2} hint="Helps you find this session later." />
  <Input name="email" type="email" label="Notify by email (optional)" placeholder="your.email@domain.com" />
  <Button type="submit" priority="primary" label="Start debugging session" />
</Form>
```

## Columns

Use `columns={2}` to put two fields on a row when there's room. The form drops to one column when two columns of `fieldMin` and the gap between them no longer fit.

**Set to 720px wide**

**Set to 360px wide**

```tsx
<Form columns={2} labelWidth="100%">
  <Input name="hours" label="Max compute hours" defaultValue="16" hint="Compute hours for the run, setup included." />
  <Input name="recipient" type="email" label="Report recipient (optional)" placeholder="your.email@domain.com" />
  <Input name="source" label="Source" defaultValue="main" />
  <Input name="description" label="Description (optional)" />
  <Button type="submit" priority="primary" label="Launch the run" />
</Form>
```

If a hint makes its row taller, all the fields in the following row move down together.

When a resize changes the column count, controls that move ease into place. `Form` skips this animation when the reader prefers reduced motion.

## Actions

To put buttons on one row, make a `Box` with `display="flex"` a direct child of `Form` and put the submit `Button` directly inside it. In a multicolumn form, the buttons align with the controls in the first column.

If the fields scroll, set `stickyActions` to keep the buttons at the bottom of the scroll area.

```tsx
<div style={{ blockSize: '220px', overflow: 'auto', overscrollBehavior: 'none', paddingInlineEnd: '16px' }}>
  <Form stickyActions>
    <Input name="image" label="Config image" multiline rows={2} />
    <Input name="hours" label="Max compute hours" defaultValue="16" />
    <Input name="source" label="Source" defaultValue="main" />
    <Input name="description" label="Description (optional)" multiline rows={2} />
    <Input name="recipient" type="email" label="Report recipient (optional)" />
    <Box display="flex" gap={8}>
      <Button type="submit" priority="primary" label="Launch the run" />
      <Button type="reset" label="Clear" />
    </Box>
  </Form>
</div>
```

Scroll through the setup fields and try **Clear** while the action row is in view.

## Keyboard

`Form` submits on no key until you choose one. Set `submitHotkey="mod+enter"` to submit with Ctrl+Enter or Cmd+Enter from a field, including a multiline `Input`. The hotkey uses the submit `Button` with `priority="primary"`.

```tsx
import { useState } from 'preact/hooks'
import { Button, Form, Input, Text } from '@antadesign/anta'

export default function Demo() {
  const [saved, setSaved] = useState(0)
  const save = (event: SubmitEvent) => {
    event.preventDefault()
    setSaved(count => count + 1)
  }

  return (
    <>
      <Form submitHotkey="mod+enter" onSubmit={save}>
        <Input name="name" label="Name" defaultValue="ci-runner" />
        <Input name="notes" label="Notes (optional)" multiline rows={2} />
        <Button type="submit" priority="primary" label="Save" />
      </Form>
      {saved > 0 && <Text>Saved {saved} {saved === 1 ? 'time' : 'times'}.</Text>}
    </>
  )
}
```

Press Ctrl+Enter or Cmd+Enter in **Name**, then in **Notes**. The save count should reach two. Enter alone does nothing in **Name** and starts a new line in **Notes**.

A form without an enabled primary submit `Button` ignores the hotkey. A focused radio or `Button` uses Enter itself, with or without the modifier, so the hotkey does not submit from there.

The hotkey submits before the focused field fires `change`, which follows when the field loses focus. Read the values from the form in `onSubmit`.

Set `submitHotkey="enter"` to submit with Enter from a single-line `Input` instead. Enter uses the form's first submit button, and nothing is submitted while that button is disabled or loading. Without a submit button, Enter submits only when the form has a single eligible text field.

With `submitHotkey="enter"`, Enter still selects the active autocomplete suggestion or commits a typed date first. It also leaves the filter of a `Select` and the segments of an `InputTime` alone. To handle Enter in your own field, call `preventDefault()` in its key handler.

## Submit button outside the form

To submit from a `Dialog` footer, give the form an `id` and pass the same value to the submit `Button`'s `form` prop.

```tsx
import { useState } from 'preact/hooks'
import { Button, Dialog, Form, Input, Select, Text, Title } from '@antadesign/anta'

export default function Demo() {
  const [open, setOpen] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const createKey = (event: SubmitEvent) => {
    event.preventDefault()
    setCreated(String(new FormData(event.currentTarget as HTMLFormElement).get('name')))
    setOpen(false)
  }

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
        <Form id="create-key" onSubmit={createKey}>
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
```

Open **Create API key**, leave **Name** empty, and select **Create key**. The required field keeps the dialog open until you enter a name and submit.

## Label width

Use `labelWidth` to give short labels like **Key** and **Value** a narrower column. Set it to `'100%'` to stack separate field labels at every width. `fieldMin` sets how narrow an input can get beside its label before the label moves above it.

**72px label column**

**100% label column**

```tsx
<>
  <Form labelWidth={72}>
    <Input name="key" label="Key" defaultValue="plugin_version" />
    <Input name="value" label="Value" defaultValue="0.0.9" />
  </Form>

  <Form labelWidth="100%">
    <Input name="key" label="Key" defaultValue="plugin_version" />
    <Input name="value" label="Value" defaultValue="0.0.9" />
  </Form>
</>
```

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `action?` | string | — | Native `action` attribute: the URL the form submits to. |
| `autoComplete?` | 'on' \| 'off' | — | Native `autocomplete` attribute. A field can set its own. |
| `columns?` | number | 1 | Maximum number of columns. The form uses fewer when a column would be narrower than `fieldMin`. |
| `dir?` | 'ltr' \| 'rtl' \| 'auto' | — | Native `dir` attribute. The layout follows it. |
| `encType?` | string | — | Native `enctype` attribute. |
| `fieldMin?` | number \| string | 200 | Sets the target minimum width for a control beside its label and for each grid column. A single column can shrink to fit its container. Use a number for pixels or a CSS length. |
| `labelWidth?` | number \| string | 140 | Width of the label column. Use a number for pixels or a CSS length or percentage. Use `'100%'` to stack the labels of `Input`, `InputTime`, and `RadioGroup`. |
| `lang?` | string | — | Native `lang` attribute. |
| `method?` | 'get' \| 'post' \| 'dialog' | — | Native `method` attribute. |
| `name?` | string | — | Native `name` attribute. |
| `noValidate?` | boolean | — | Native `novalidate` attribute. Skips the browser's validation on submit. |
| `stickyActions?` | boolean | — | Keeps the row of actions in view at the bottom of the nearest scrolling ancestor while the form scrolls. Place the submit `Button` directly inside a `Box` that is a direct child of `Form`. |
| `submitHotkey?` | 'mod+enter' \| 'enter' | — | The key that submits the form. `'mod+enter'` is Ctrl+Enter or Cmd+Enter in a field, including a multiline `Input`, and uses the enabled primary submit `Button`. `'enter'` is Enter in a single-line `Input` and uses the form's first submit button. Without it no key submits. |
| `target?` | string | — | Native `target` attribute. |

## Web Component

`Form` renders `<a-form>` around a native `<form>`. Outside JSX, write both and import `@antadesign/anta/elements/a-form`. Set `submit-hotkey` and `sticky-actions` on `<a-form>`. The native form keeps its own attributes, its validation, and its `submit` event.

```html
<a-form submit-hotkey="mod+enter">
  <form>
    <a-input name="name"><span slot="label">Name</span></a-input>
    <a-checkbox role="checkbox" tabindex="0" name="remind">
      <a-checkbox-label>Email me before the key expires</a-checkbox-label>
    </a-checkbox>
    <a-button role="button" tabindex="0" type="submit" priority="primary">
      <a-button-label>Create key</a-button-label>
    </a-button>
  </form>
</a-form>
```

Load the entries for the controls you use. See [Button](./button.md) for the events a submit button dispatches.

## Native HTML

For the layout alone, add `data-anta` to a `<form>` and import `@antadesign/anta/elements/a-form`. A native form gets the label column and the columns. It does not get the hotkey, the sticky action row, or the animated column changes.

```html
<form data-anta>
  <a-input name="name"><span slot="label">Name</span></a-input>
  <a-button role="button" tabindex="0" type="submit" priority="primary">
    <a-button-label>Create key</a-button-label>
  </a-button>
</form>
```

## Styling

To share a layout across forms, set the CSS variables on a common ancestor. `--form-label-width` and `--form-label-gap` default to `140px` and `12px`. `--form-field-min` defaults to `200px`, and `--form-columns` defaults to `1`. Use `row-gap` to change the space between rows. The default column gap is `24px`.

```css
/* The class is only for the demo. Put the variables on any ancestor of the forms. */
.compact-forms { --form-label-width: 56px; --form-label-gap: 8px; }
.compact-forms form { row-gap: 8px; }
```
