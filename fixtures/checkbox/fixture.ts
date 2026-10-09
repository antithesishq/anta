const checkboxFixture = `import { Button, Checkbox } from '@antadesign/anta'
import { useState } from 'react'

type CheckboxState = false | true | 'indeterminate'

const FIXTURE_COUNT = 5

function CheckboxFixture({ fixtureIndex }) {
  const [disabled, setDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [currentState, setCurrentState] = useState<CheckboxState>('indeterminate')

  return (
    <section style={{ display: 'grid', alignContent: 'start', gap: '12px', padding: '20px', border: '1px solid var(--border-2)', borderRadius: '12px' }}>
      <strong>Checkbox {fixtureIndex + 1}</strong>
      <div
        style={{ minHeight: '72px', padding: '16px', background: 'var(--bg-1)' }}
      >
        {mounted ? (
          <Checkbox
            data-fixture-target
            defaultChecked="indeterminate"
            disabled={disabled}
            label={'Select all notifications ' + (fixtureIndex + 1)}
            hint={disabled ? 'Notification selection is unavailable.' : 'Include every notification in this selection.'}
            onValueChange={(_event, value) => {
              setCurrentState(value.indeterminate ? 'indeterminate' : value.checked)
            }}
          />
        ) : (
          <p>The notification selection is unavailable.</p>
        )}
      </div>

      <output aria-live="polite" style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted
          ? String(currentState) + ', ' + (disabled ? 'disabled' : 'enabled')
          : 'Unmounted'}
      </output>

      <div aria-label="Fixture controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          priority="secondary"
          onClick={() => setDisabled((current) => !current)}
        >
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button
          priority="secondary"
          onClick={() => {
            const nextMounted = !mounted
            if (nextMounted) setCurrentState('indeterminate')
            setMounted(nextMounted)
          }}
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
      data-fixture="checkbox"
      style={{ display: 'grid', width: 'min(100%, 1200px)', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}
    >
      {Array.from({ length: FIXTURE_COUNT }, (_, fixtureIndex) => (
        <CheckboxFixture key={fixtureIndex} fixtureIndex={fixtureIndex} />
      ))}
    </main>
  )
}
`

export default checkboxFixture
