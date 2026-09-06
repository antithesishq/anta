/** Shared color guidance for the swatches and shipped Markdown. */
export type Kind = 'bg' | 'text' | 'border'
export const KINDS: Kind[] = ['bg', 'text', 'border']
export const TITLES: Record<Kind, string> = { bg: 'Background', text: 'Text', border: 'Border' }
export const INTROS: Record<Kind, string> = {
  bg: 'Background tokens establish surface hierarchy.',
  text: 'Text tokens establish content priority and contrast.',
  border: 'Border tokens separate and group elements.',
}
export const TEXT_LINES = [
  { token: 'text-1', copy: 'Primary text, for headings and key content.' },
  { token: 'text-2', copy: 'Secondary text, for descriptions and supporting content.' },
  { token: 'text-3', copy: 'Subdued text, for labels, statuses, and secondary data.' },
  { token: 'text-4', copy: 'Minor text, for timestamps, counters, and metadata.' },
  { token: 'text-5', copy: 'Placeholder text, for hints and non-critical information.' },
]
export const BACKGROUND_GUIDANCE = `Background numbers describe a lightness scale. Give surfaces meaningful names in your application by defining semantic aliases for these tokens.`
export const LINK_GUIDANCE = `### Link color

Links use \`--link-color\` at rest and \`--link-color-hover\` on hover. Both tokens pair light and dark values independently of the text scale.`
export const BORDER_GUIDANCE = `Use border tokens according to the surface and the separation it needs:

- \`border-1\` and \`border-2\` define strong boundaries, including on \`bg-4\` and \`bg-5\`.
- \`border-3\` provides a visible, moderate boundary.
- \`border-4\` separates \`bg-2\` and \`bg-3\`.
- \`border-5\` provides subtle separation between \`bg-2\` and \`bg-1\`.

### Focus ring

\`--focus-ring\` supplies the keyboard-focus outline color across components. It pairs light and dark values. Components use this global token directly.`
