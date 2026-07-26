export default `import { Toaster, Button, Input, Checkbox, Banner, Card } from '@antadesign/anta'

// Read the live control values when a toast is fired (the controls are
// uncontrolled — a-input exposes .value, a-checkbox exposes .checked).
const opts = () => ({
  duration: Number(document.getElementById('dur').value),
  closable: document.getElementById('cls').checked,
})

<div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
  <Toaster />
  <Input id="dur" type="number" defaultValue="4000" label="Duration (ms)" />
  <Checkbox id="cls" defaultChecked label="Closable" />
  <Button
    label="Toast a Banner"
    onClick={() =>
      Toaster.manager.add(
        () => <Banner tone="success" round message="Your changes were saved." closable={false} />,
        opts(),
      )
    }
  />
  <Button
    label="Toast a Card"
    onClick={() =>
      Toaster.manager.add(
        () => (
          <Card tone="info" size="small" header="Deployment ready">
            Your build passed all checks.
          </Card>
        ),
        opts(),
      )
    }
  />
</div>
`
