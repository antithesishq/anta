/** Demo source for the Steps playground. */
export default `import { Steps, TabPanel, Text, type StepOption } from '@antadesign/anta'

/** @play props Completed step */
const completed = {
  value: 'completed',
  label: 'Completed',
  state: 'completed',
} satisfies StepOption

/** @play props Loading step */
const loading = {
  value: 'loading',
  label: 'Loading',
  state: 'loading',
} satisfies StepOption

/** @play props Error step */
const error = {
  value: 'error',
  label: 'Error',
  state: 'error',
} satisfies StepOption

/** @play props Incomplete step */
const incomplete = {
  value: 'incomplete',
  label: 'Incomplete',
  state: 'incomplete',
} satisfies StepOption

/** @play props Disabled step */
const disabled = {
  value: 'disabled',
  label: 'Disabled',
  hint: 'Unavailable',
  state: 'incomplete',
  disabled: true,
} satisfies StepOption

/** @play props Steps */
<Steps
  defaultValue={loading.value}
  label="Task state"
  options={[completed, loading, error, incomplete, disabled]}
>
  <TabPanel value={completed.value}><Text size="small">This work is complete and ready to use.</Text></TabPanel>
  <TabPanel value={loading.value}><Text size="small">This work is currently running.</Text></TabPanel>
  <TabPanel value={error.value}><Text size="small">Resolve this error before continuing.</Text></TabPanel>
  <TabPanel value={incomplete.value}><Text size="small">This work has not started yet.</Text></TabPanel>
</Steps>
`
