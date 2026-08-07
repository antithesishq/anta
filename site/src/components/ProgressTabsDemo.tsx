import { useEffect, useState } from 'preact/hooks'
import { Button, ProgressTabs, TabPanel } from '@antadesign/anta'
import type { ProgressTabOption } from '@antadesign/anta'

function useElements() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])
}

const phases: ProgressTabOption[] = [
  { value: 'build', label: 'Build', status: 'completed' },
  { value: 'setup', label: 'Setup', status: 'loading' },
  { value: 'next', label: 'Next steps', status: 'incomplete', disabled: true },
]

const statusExamples: ProgressTabOption[] = [
  { value: 'completed', label: 'Completed', status: 'completed' },
  { value: 'loading', label: 'Loading', status: 'loading' },
  { value: 'error', label: 'Error', status: 'error' },
  { value: 'incomplete', label: 'Incomplete', status: 'incomplete', disabled: true },
]

const panel = {
  minHeight: '72px',
  marginTop: '16px',
  padding: '16px',
  border: '1px solid var(--border-4)',
  borderRadius: '8px',
}

export function Basic() {
  useElements()
  return (
    <div style={{ width: '100%', maxWidth: '560px' }}>
      <ProgressTabs defaultValue="setup" label="Deployment progress" options={phases}>
        <TabPanel value="build" style={panel}>Build output and artifacts.</TabPanel>
        <TabPanel value="setup" style={panel}>Configure the deployment environment.</TabPanel>
        <TabPanel value="next" style={panel}>Share the deployment and review results.</TabPanel>
      </ProgressTabs>
    </div>
  )
}

export function Statuses() {
  useElements()
  return (
    <div style={{ width: '100%' }}>
      <ProgressTabs
        label="Status examples"
        showNavigation={false}
        options={statusExamples}
      />
    </div>
  )
}

export function ControlledSequence() {
  useElements()
  const [value, setValue] = useState('setup')
  const [setupComplete, setSetupComplete] = useState(false)
  const options: ProgressTabOption[] = [
    { value: 'build', label: 'Build', status: 'completed' },
    { value: 'setup', label: 'Setup', status: setupComplete ? 'completed' : 'loading' },
    { value: 'next', label: 'Next steps', status: 'incomplete', disabled: !setupComplete },
  ]

  return (
    <div style={{ width: '100%', maxWidth: '560px' }}>
      <ProgressTabs
        value={value}
        label="Release progress"
        options={options}
        onStateChange={(_event, { next }) => next && setValue(next)}
      />
      <Button
        style={{ marginTop: '16px' }}
        label={setupComplete ? 'Reset setup' : 'Complete setup'}
        priority="secondary"
        onClick={() => {
          setSetupComplete((complete) => !complete)
          setValue(setupComplete ? 'setup' : 'next')
        }}
      />
    </div>
  )
}

export function Sizes() {
  useElements()
  return (
    <div style={{ display: 'grid', gap: '20px', width: '100%' }}>
      {(['small', 'medium', 'large'] as const).map((size) => (
        <ProgressTabs
          key={size}
          size={size}
          defaultValue="setup"
          label={`${size} progress tabs`}
          showNavigation={false}
          options={phases}
        />
      ))}
    </div>
  )
}

export function Vertical() {
  useElements()
  return (
    <div style={{ width: '100%', maxWidth: '480px' }}>
      <ProgressTabs
        orientation="vertical"
        defaultValue="setup"
        label="Deployment progress"
        options={[
          { value: 'build', label: 'Build', status: 'completed' },
          { value: 'setup', label: 'Setup', status: 'loading' },
          { value: 'next', label: 'Next steps', status: 'incomplete' },
        ]}
      >
        <TabPanel value="build">Build output and artifacts are ready.</TabPanel>
        <TabPanel value="setup">Preparing the deployment environment.</TabPanel>
        <TabPanel value="next">Review the deployment and share the result.</TabPanel>
      </ProgressTabs>
    </div>
  )
}

export function CustomNavigation() {
  useElements()
  return (
    <div style={{ width: '100%', maxWidth: '560px' }}>
      <ProgressTabs
        defaultValue="setup"
        label="Deployment progress"
        options={[
          { value: 'build', label: 'Build', status: 'completed' },
          { value: 'setup', label: 'Setup', status: 'completed' },
          { value: 'next', label: 'Next steps', status: 'incomplete' },
        ]}
        renderPreviousButton={(props) => (
          <Button {...props} priority="secondary" label="Back" />
        )}
        renderNextButton={(props) => (
          <Button {...props} label="Continue" />
        )}
      />
    </div>
  )
}
