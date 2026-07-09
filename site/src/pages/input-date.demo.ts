/**
 * Demo source for the InputDate playground. Stored in a sibling .ts file (not
 * inlined in the .mdx) so Astro's MDX pipeline doesn't mangle the template
 * literal's indentation — see input.demo.ts.
 */
export default `import { InputDate } from '@antadesign/anta'

<InputDate
  label="Due date"
  defaultValue="2026-06-15"
  onValueChange={(v) => console.log('date', v)}
/>
`
