/**
 * Demo source for the Calendar playground. Stored in a sibling .ts file (not
 * inlined in the .mdx) so Astro's MDX pipeline doesn't mangle the template
 * literal's indentation — see input.demo.ts.
 */
export default `import { Calendar } from '@antadesign/anta'

<Calendar
  defaultValue="2026-06-28"
  onValueChange={(_e, { value }) => console.log('picked', value)}
/>
`
