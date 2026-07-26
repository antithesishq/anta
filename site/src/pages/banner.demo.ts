/**
 * Demo source code for the Banner playground. See progress.demo.ts for the
 * rationale on storing this in a sibling .ts file rather than inlining the
 * template literal in the .mdx.
 */
export default `import { Banner, Button } from '@antadesign/anta'

<Banner
  tone="info"
  message="Antithesis found a new bug in your latest build."
  actions={<Button size="small" priority="tertiary" tone="info" label="View report" />}
/>
`
