import { useLayoutEffect, useState } from 'react'
import { Tabs as AntaTabs, TabPanel } from '@antadesign/anta'

declare global {
  interface Window {
    __antaTabs?: { id: string; value: string; changes: number }
  }
}

const options = [
  { value: 'overview', label: 'Overview' },
  { value: 'details', label: 'Details', disabled: true },
  { value: 'activity', label: 'Activity' },
]

export function Tabs({ id, disabled = false, defaultValue = 'overview' }: {
  id: string; disabled?: boolean; defaultValue?: string
}) {
  const [value, setValue] = useState(defaultValue)

  useLayoutEffect(() => {
    window.__antaTabs = { id, value: defaultValue, changes: 0 }
    return () => { delete window.__antaTabs }
  }, [id])

  return <AntaTabs id={id} label="Information" disabled={disabled} value={value}
      options={options.map(option => ({ ...option, 'data-testid': `${id}-${option.value}` }))}
      onStateChange={(_event, { next }) => {
        window.__antaTabs!.value = next!
        window.__antaTabs!.changes += 1
        setValue(next!)
      }}>
      <TabPanel value="overview"><p>Overview content</p></TabPanel>
      <TabPanel value="details"><p>Details content</p></TabPanel>
      <TabPanel value="activity"><p>Activity content</p></TabPanel>
    </AntaTabs>
}
