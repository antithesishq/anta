/**
 * Demo source code for the Progress playground.
 *
 * This file exists only so the template literal's whitespace is
 * preserved verbatim. When the same string is inlined as a JSX
 * attribute in the `.mdx` page, Astro's MDX pipeline strips a layer
 * of common-leading-whitespace, which scrambles the indentation
 * Monaco needs for folding ranges. A plain `.ts` file routes
 * through Vite without that transform.
 */
export default `import { Progress } from '@antadesign/anta'

<Progress value={42} label="Uploading files…" hint="3 of 7" />
`
