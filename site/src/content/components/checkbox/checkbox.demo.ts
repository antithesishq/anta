/**
 * Demo source code for the Checkbox playground. See progress.demo.ts for the
 * rationale on storing this in a sibling .ts file rather than inlining the
 * template literal in the .mdx. Static JSX so the auto props panel binds to
 * the `<Checkbox>` instance — flip state / disabled / tone / size from the panel
 * to see every variation.
 */
export default `import { Checkbox } from '@antadesign/anta'

<Checkbox label="Enable notifications" />
`
