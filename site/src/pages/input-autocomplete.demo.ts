/**
 * Demo source for the InputAutocomplete playground. Kept in a sibling .ts file so
 * Astro's MDX pipeline doesn't mangle the template literal's indentation.
 */
export default `import { InputAutocomplete } from '@antadesign/anta'

const frameworks = [
  'React', 'Preact', 'Solid', 'Svelte', 'Vue', 'Angular', 'Qwik', 'Lit', 'Astro',
]

<InputAutocomplete
  label="Framework"
  placeholder="Type to search…"
  hint="Pick a suggestion, or type your own — the value is whatever you type."
  clearable
  suggestions={frameworks}
  defaultValue=""
/>`
