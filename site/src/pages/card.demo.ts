/**
 * Demo source code for the Card playground. See progress.demo.ts for the
 * rationale on storing this in a sibling .ts file rather than inlining the
 * template literal in the .mdx.
 */
export default `import { Card, Button } from '@antadesign/anta'

<Card
  header="Deployment ready"
  footer={<><Button priority="primary" label="Deploy" /><Button label="Cancel" /></>}
>
  Your build passed every check and is ready to ship to production.
</Card>
`
