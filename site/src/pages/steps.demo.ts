/** Demo source for the Steps playground. */
export default `import { Steps, TabPanel, Text } from '@antadesign/anta'

const options = [
  { value: 'completed', label: 'Completed', state: 'completed' },
  { value: 'loading', label: 'Loading', state: 'loading' },
  { value: 'error', label: 'Error', state: 'error' },
  { value: 'incomplete', label: 'Incomplete', state: 'incomplete' },
  { value: 'disabled', label: 'Disabled', hint: 'Unavailable', state: 'incomplete', disabled: true },
]

<Steps
  defaultValue="loading"
  label="Task state"
  options={options}
>
  <TabPanel value="completed"><Text size="small">This work is complete and ready to use.</Text></TabPanel>
  <TabPanel value="loading"><Text size="small">This work is currently running.</Text></TabPanel>
  <TabPanel value="error"><Text size="small">Resolve this error before continuing.</Text></TabPanel>
  <TabPanel value="incomplete"><Text size="small">This work has not started yet.</Text></TabPanel>
</Steps>
`
