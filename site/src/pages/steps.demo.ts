/** Demo source for the Steps playground. */
export default `import { Steps, TabPanel, Text } from '@antadesign/anta'

const options = [
  { value: 'completed', label: 'Completed', status: 'completed' },
  { value: 'loading', label: 'Loading', status: 'loading' },
  { value: 'error', label: 'Error', status: 'error' },
  { value: 'incomplete', label: 'Incomplete', status: 'incomplete' },
  { value: 'disabled', label: 'Disabled', hint: 'Unavailable', status: 'incomplete', disabled: true },
]

<Steps
  defaultValue="loading"
  label="Task status"
  options={options}
>
  <TabPanel value="completed"><Text size="small">This work is complete and ready to use.</Text></TabPanel>
  <TabPanel value="loading"><Text size="small">This work is currently running.</Text></TabPanel>
  <TabPanel value="error"><Text size="small">Resolve this error before continuing.</Text></TabPanel>
  <TabPanel value="incomplete"><Text size="small">This work has not started yet.</Text></TabPanel>
</Steps>
`
