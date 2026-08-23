import { useEffect, useState } from 'preact/hooks'
import { Button, Icon, Steps, TabPanel, Text } from '@antadesign/anta'
import type { StepOption, StepTone } from '@antadesign/anta'

function useElements() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])
}

const phases: StepOption[] = [
  { value: 'build', label: 'Build', status: 'completed' },
  { value: 'setup', label: 'Setup', status: 'loading' },
  { value: 'next', label: 'Next steps', status: 'incomplete', disabled: true },
]

const fullWidthPhases: StepOption[] = [
  { value: 'build', label: 'Build', status: 'completed' },
  { value: 'review', label: 'Review', status: 'loading' },
  { value: 'deploy', label: 'Deploy', status: 'incomplete' },
]

const statusExamples: StepOption[] = [
  { value: 'completed', label: 'Completed', status: 'completed' },
  { value: 'loading', label: 'Loading', status: 'loading' },
  { value: 'error', label: 'Error', status: 'error' },
  { value: 'incomplete', label: 'Incomplete', status: 'incomplete' },
]

const toneExamples: Array<{ tone: StepTone; label: string }> = [
  { tone: 'neutral', label: 'Neutral' },
  { tone: 'brand', label: 'Brand' },
  { tone: 'info', label: 'Info' },
  { tone: 'success', label: 'Success' },
  { tone: 'warning', label: 'Warning' },
  { tone: 'critical', label: 'Critical' },
]

const customExamples: StepOption[] = [
  {
    value: 'draft',
    label: 'Draft',
    hint: 'Content saved',
    status: 'completed',
    marker: 1,
  },
  {
    value: 'approval',
    label: 'Approval',
    hint: 'Waiting for review',
    status: 'loading',
  },
  {
    value: 'publish',
    label: 'Publish',
    hint: 'Not started',
    status: 'incomplete',
    marker: 'send',
  },
]

const panel = {
  minHeight: '72px',
  marginTop: '16px',
  padding: '16px',
  border: '1px solid var(--border-4)',
  borderRadius: '8px',
}

const panelText = (children: React.ReactNode) => (
  <Text size="small">{children}</Text>
)

export function Statuses() {
  useElements()
  return (
    <div style={{ width: '100%' }}>
      <Steps fill defaultValue="loading" label="Task status" options={statusExamples}>
        <TabPanel value="completed" style={panel}>{panelText('This work is complete and ready to use.')}</TabPanel>
        <TabPanel value="loading" style={panel}>{panelText('This work is currently running.')}</TabPanel>
        <TabPanel value="error" style={panel}>{panelText('Resolve this error before continuing.')}</TabPanel>
        <TabPanel value="incomplete" style={panel}>{panelText('This work has not started yet.')}</TabPanel>
      </Steps>
    </div>
  )
}

export function Tones() {
  useElements()
  return (
    <div style={{ display: 'grid', gap: '16px', width: '100%' }}>
      {toneExamples.map(({ tone, label }) => (
        <Steps
          key={tone}
          tone={tone}
          defaultValue="current"
          label={`${label} steps`}
          options={[
            { value: 'done', label: 'Done', hint: 'Complete', status: 'completed' },
            { value: 'current', label: `${label} validation in progress`, hint: 'Checking security and dependency scans', status: 'loading' },
            { value: 'next', label: 'Next', hint: 'Waiting', status: 'incomplete' },
          ]}
        />
      ))}
    </div>
  )
}

export function Customization() {
  useElements()
  return (
    <div style={{ width: '100%' }}>
      <Steps
        defaultValue="approval"
        label="Custom step markers"
        options={customExamples}
        renderMarker={(option, { selected }) =>
          option.status === 'loading' ? (
            <Icon shape={selected ? 'refresh-ccw-dot' : 'hourglass'} />
          ) : undefined
        }
      />
    </div>
  )
}

export function ControlledSequence() {
  useElements()
  const [value, setValue] = useState('setup')
  const [setupComplete, setSetupComplete] = useState(false)
  const options: StepOption[] = [
    { value: 'build', label: 'Build', status: 'completed' },
    { value: 'setup', label: 'Setup', status: setupComplete ? 'completed' : 'loading' },
    { value: 'next', label: 'Next steps', status: 'incomplete', disabled: !setupComplete },
  ]

  return (
    <div style={{ width: '100%', maxWidth: '560px' }}>
      <Steps
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
        <Steps
          key={size}
          size={size}
          defaultValue="setup"
          label={`${size} steps`}
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
      <Steps
        orientation="vertical"
        defaultValue="setup"
        label="Deployment progress"
        options={[
          { value: 'build', label: 'Build', status: 'completed' },
          { value: 'setup', label: 'Setup', status: 'loading' },
          { value: 'next', label: 'Next steps', status: 'incomplete' },
        ]}
      >
        <TabPanel value="build">{panelText('Build output and artifacts are ready.')}</TabPanel>
        <TabPanel value="setup">{panelText('Preparing the deployment environment.')}</TabPanel>
        <TabPanel value="next">{panelText('Review the deployment and share the result.')}</TabPanel>
      </Steps>
    </div>
  )
}

export function ComposedNavigation() {
  useElements()
  const options: StepOption[] = [
    { value: 'build', label: 'Build', status: 'completed' },
    { value: 'setup', label: 'Setup', status: 'loading' },
    { value: 'next', label: 'Next steps', status: 'incomplete' },
  ]
  const [value, setValue] = useState('setup')
  const index = options.findIndex((option) => option.value === value)

  return (
    <div style={{ width: '100%', maxWidth: '560px' }}>
      <Steps
        value={value}
        label="Deployment progress"
        options={options}
        onStateChange={(_event, { next }) => next && setValue(next)}
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <Button
          label="Back"
          priority="tertiary"
          tone="brand"
          disabled={index <= 0}
          onClick={() => setValue(options[index - 1].value)}
        />
        <Button
          label="Continue"
          priority="secondary"
          tone="brand"
          disabled={index >= options.length - 1}
          onClick={() => setValue(options[index + 1].value)}
        />
      </div>
    </div>
  )
}

export function DottedConnectorStyle() {
  useElements()
  return (
    <div style={{ width: '100%', maxWidth: '560px' }}>
      <Steps
        className="dotted-steps"
        defaultValue="setup"
        label="Deployment progress"
        options={phases}
      />
    </div>
  )
}

export function FullWidthSteps() {
  useElements()
  return (
    <div style={{ width: '100%' }}>
      <Steps
        fill
        defaultValue="review"
        label="Deployment progress"
        options={fullWidthPhases}
      />
    </div>
  )
}
