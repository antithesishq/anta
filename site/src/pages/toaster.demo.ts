export default `import { Toaster, Button, Banner } from '@antadesign/anta'

<Toaster />
<Button
  label="Toast it"
  onClick={() =>
    Toaster.manager.add(
      () => <Banner tone="success" round message="Your changes were saved." closable={false} />,
      { placement: 'bottom-right', duration: 4000, closable: true },
    )
  }
/>
`
