/**
 * Demo source for the InputTime playground. Stored in a sibling .ts file (not
 * inlined in the .mdx) so Astro's MDX pipeline doesn't mangle the template
 * literal's indentation — see input-date.demo.ts.
 */
export default `import { InputTime } from '@antadesign/anta'

<InputTime
  label="Start time"
  defaultValue="09:30"
  onValueChange={(_, { value }) => console.log('time', value)}
/>
`
