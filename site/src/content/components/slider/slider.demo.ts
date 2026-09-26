/** Playground source for Slider. Kept beside the page so MDX preserves the
 * template literal's whitespace. */
export default `import { Slider } from '@antadesign/anta'

<Slider
  label="Volume"
  defaultValue={55}
  valueSuffix="%"
  markers={[
    { value: 0, label: 'Mute' },
    { value: 50, label: 'Comfortable' },
    { value: 100, label: 'Maximum' },
  ]}
  onValueChange={(_, { value }) => console.log('volume', value)}
/>
`
