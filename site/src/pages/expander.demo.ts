/**
 * Demo source code for the Expander playground. See progress.demo.ts for
 * the rationale on storing this in a sibling .ts file rather than inlining
 * the template literal in the .mdx.
 */
export default `import { Expander, Text, Button, Tag } from '@antadesign/anta'

<Expander title="What is automated testing?" defaultOpen>
  <Text>
    Automated testing runs checks against your software and reports failures
    that you can investigate and reproduce.
  </Text>
</Expander>
`
