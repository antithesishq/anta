const checkboxFixture = `import { Button, Checkbox } from '@antadesign/anta'
import { useState } from 'react'

type CheckboxState = false | true | 'indeterminate'

export default function App() {
  const [disabled, setDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [currentState, setCurrentState] = useState<CheckboxState>('indeterminate')

  return (
    <main
      data-fixture="checkbox"
      style={{ display: 'grid', maxWidth: '640px', gap: '24px' }}
    >
      <div
        style={{ minHeight: '72px', padding: '20px', border: '1px solid var(--border-2)', borderRadius: '12px', background: 'var(--bg-1)' }}
      >
        {mounted ? (
          <Checkbox
            data-fixture-target
            defaultChecked="indeterminate"
            disabled={disabled}
            label="Select all notifications"
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
    </main>
  )
}
`

export default checkboxFixture
