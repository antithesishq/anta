/**
 * Demo source code for the Card playground. See progress.demo.ts for the
 * rationale on storing this in a sibling .ts file rather than inlining the
 * template literal in the .mdx.
 */
export default `import { Card, Button } from '@antadesign/anta'

<Card
  icon="book-open"
  header="Deployment ready"
  subtitle="Build #1284 · main"
  footer={<><Button priority="primary" label="Deploy" /><Button label="Cancel" /></>}
>
  Your build passed every check and is ready to ship to production.
</Card>
`
