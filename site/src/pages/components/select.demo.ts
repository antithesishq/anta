/**
 * Demo source for the Select playground. Kept in a sibling .ts file so Astro's
 * MDX pipeline doesn't mangle the template literal's indentation.
 */
export default `import { Select } from '@antadesign/anta'

<Select
  label="Field"
  placeholder="Select a field…"
  defaultValue="stream"
  style={{ width: '260px' }}
  options={[
    { value: 'output_text', label: 'output_text', hint: 'Raw log message or event payload' },
    { value: 'stream', label: 'stream', hint: 'Log level: error · info · internal' },
    { value: 'container', label: 'container', hint: 'Host where the event occurred' },
    { value: 'vtime', label: 'vtime', hint: 'Simulation time, in seconds' },
    { value: 'custom', label: 'custom', hint: 'e.g. metadata.log.timeout' },
  ]}
/>`
