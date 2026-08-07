/** Demo source for the ProgressTabs playground. */
export default `import { ProgressTabs, TabPanel } from '@antadesign/anta'

const phases = [
  { value: 'build', label: 'Build', status: 'completed' },
  { value: 'setup', label: 'Setup', status: 'loading' },
  { value: 'next', label: 'Next steps', status: 'incomplete', disabled: true },
]

<ProgressTabs
  defaultValue="setup"
  label="Deployment progress"
  options={phases}
>
  <TabPanel value="build">Build output and artifacts.</TabPanel>
  <TabPanel value="setup">Configure the deployment environment.</TabPanel>
  <TabPanel value="next">Share the deployment and review results.</TabPanel>
</ProgressTabs>
`
