/** Demo source for the Steps playground. */
export default `import { Steps, TabPanel, Text } from '@antadesign/anta'

const phases = [
  { value: 'build', label: 'Build', hint: 'Artifacts ready', status: 'completed', marker: 1 },
  { value: 'setup', label: 'Setup', hint: 'In progress', status: 'loading', marker: 2 },
  { value: 'next', label: 'Next steps', hint: 'Unavailable', status: 'incomplete', marker: 3, disabled: true },
]

<Steps
  defaultValue="setup"
  label="Deployment progress"
  options={phases}
>
  <TabPanel value="build"><Text size="small">Build output and artifacts.</Text></TabPanel>
  <TabPanel value="setup"><Text size="small">Configure the deployment environment.</Text></TabPanel>
  <TabPanel value="next"><Text size="small">Share the deployment and review results.</Text></TabPanel>
</Steps>
`
