export default `import { Toaster, Button, Banner } from '@antadesign/anta'

<Toaster />
<Button
  label="Toast it"
  onClick={() =>
    Toaster.manager.add(
      (id) => (
        <Banner
          tone="success"
          round
          message="Your changes were saved."
          onDismiss={() => Toaster.manager.dismiss(id)}
        />
      ),
      { placement: 'bottom-right', duration: 4000 },
    )
  }
/>
`
