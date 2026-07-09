/**
 * Demo source for the Tooltip playground — a single tooltip on a single
 * button, wrapped in a `.container` the CSS tab can position (see the
 * `initialCss` passed to <Playground> in tooltip.mdx).
 *
 * Kept in a sibling `.ts` file (not inlined in the `.mdx`) so the template
 * literal's indentation round-trips verbatim — Astro's MDX pipeline strips
 * common leading whitespace from JSX-attribute template literals.
 *
 * The props panel binds to the `<Tooltip>` (delay / placement / follow /
 * interactive); the `<Button>` is just the anchor it's attached to.
 */
export default `import { Tooltip, Button } from '@antadesign/anta'

<div className="container">
  <Button label="Hover me">
    <Tooltip delay={250}>Edit my props on the right →</Tooltip>
  </Button>
</div>
`
