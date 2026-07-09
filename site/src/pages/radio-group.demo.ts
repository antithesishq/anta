/**
 * Demo source for the RadioGroup playground. Kept in a sibling .ts file (not
 * inlined in the .mdx) so Astro's MDX pipeline doesn't mangle the template
 * literal's indentation — see button.demo.ts.
 */
export default `import { RadioGroup } from '@antadesign/anta'

<RadioGroup
  name="contact"
  label="How should we reach you?"
  hint="We'll only use this for account alerts."
  defaultValue="email"
  options={[
    { value: 'email', label: 'Email', hint: 'A confirmation link goes to your inbox.' },
    { value: 'sms', label: 'SMS', hint: 'Standard message rates apply.' },
    { value: 'push', label: 'Push notification' },
  ]}
/>
`
