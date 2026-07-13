/**
 * Demo source code for the Dialog playground. Kept in a sibling .ts file so
 * Astro's MDX pipeline doesn't mangle the template literal's indentation (see
 * progress.demo.ts for the full rationale). Uses the uncontrolled `name`
 * trigger so the demo needs no state: the Button opens the matching Dialog, and
 * the footer Button closes it. Flip `position` / `closable` / `dismissable`
 * from the props panel to explore.
 */
export default `import { Dialog, Button, Text } from '@antadesign/anta'

<Button data-dialog-open="demo">Open dialog</Button>
<Dialog
  name="demo"
  header="Welcome to Anta"
  footer={<Button priority="primary" data-dialog-close="demo">Got it</Button>}
>
  <Text>
    A dialog renders above a dimmed overlay in the browser's top layer, so it
    escapes any overflow or stacking context on the page. Press Esc, click the
    backdrop, or use the ✕ to dismiss it.
  </Text>
</Dialog>
`
