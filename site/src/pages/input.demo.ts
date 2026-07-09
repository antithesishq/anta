/**
 * Demo source for the Input playground. Stored in a sibling .ts file (not
 * inlined in the .mdx) so Astro's MDX pipeline doesn't mangle the template
 * literal's indentation — see progress.demo.ts.
 */
export default `import { Input, Icon } from '@antadesign/anta'

<Input
  label="Search"
  placeholder="Search the docs…"
  hint="Press Enter to search."
  leading={<Icon shape="search" />}
  clearable
  dimActions
  defaultValue="design tokens"
/>
`
