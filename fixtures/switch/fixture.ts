const switchFixture = `import { Button, Switch } from '@antadesign/anta'
import { useState } from 'react'

const FIXTURE_COUNT = 5

function SwitchFixture({ fixtureIndex }) {
  const [checked, setChecked] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)

  return (
    <section style={{ display: 'grid', alignContent: 'start', gap: '12px', padding: '20px', border: '1px solid var(--border-2)', borderRadius: '12px' }}>
      <strong>Switch {fixtureIndex + 1}</strong>
      <div
        style={{ minHeight: '72px', padding: '16px', background: 'var(--bg-1)' }}
      >
        {mounted ? (
          <Switch
            data-fixture-target
            checked={checked}
            disabled={disabled}
            label={'Automatic updates ' + (fixtureIndex + 1)}
            hint={disabled ? 'Managed by your organization.' : 'Install updates automatically.'}
            onStateChange={(_event, { next }) => setChecked(next)}
          />
        ) : (
          <p>The automatic update setting is unavailable.</p>
        )}
      </div>

      <output aria-live="polite" style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted
          ? (checked ? 'On' : 'Off') + ', ' + (disabled ? 'locked' : 'editable')
          : 'Removed, parent value is ' + (checked ? 'on' : 'off')}
      </output>

      <div aria-label="Fixture controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          priority="secondary"
          onClick={() => setChecked((value) => !value)}
        >
          Controlled update
        </Button>

        <Button
          priority="secondary"
          onClick={() => setDisabled((value) => !value)}
        >
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button
          priority="secondary"
          onClick={() => setMounted((value) => !value)}
        >
          {mounted ? 'Unmount' : 'Mount'}
        </Button>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <main
      data-fixture="switch"
      style={{ display: 'grid', width: 'min(100%, 1200px)', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}
    >
      {Array.from({ length: FIXTURE_COUNT }, (_, fixtureIndex) => (
        <SwitchFixture key={fixtureIndex} fixtureIndex={fixtureIndex} />
      ))}
    </main>
  )
}
`

export default switchFixture
