const checkboxFixture = `import { Button, Checkbox } from '@antadesign/anta'
import { useState } from 'react'

type CheckboxState = false | true | 'indeterminate'

export default function App() {
  const [disabled, setDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [currentState, setCurrentState] = useState<CheckboxState>('indeterminate')
  const [stateWhenDisabled, setStateWhenDisabled] = useState<CheckboxState | null>(null)
  const [requestedWhileDisabled, setRequestedWhileDisabled] = useState(false)
  const [lastTransition, setLastTransition] = useState<{ prev: CheckboxState, next: CheckboxState } | null>(null)

  return (
    <main
      data-fixture="checkbox"
      data-expected-disabled={String(disabled)}
      data-expected-mounted={String(mounted)}
      data-requested-while-disabled={String(requestedWhileDisabled)}
      data-state-when-disabled={stateWhenDisabled === null ? undefined : String(stateWhenDisabled)}
      data-last-transition={lastTransition ? String(lastTransition.prev) + '>' + String(lastTransition.next) : undefined}
      style={{ display: 'grid', maxWidth: '640px', gap: '24px' }}
    >
      <form
        data-fixture-form
        style={{ minHeight: '72px', padding: '20px', border: '1px solid var(--border-2)', borderRadius: '12px', background: 'var(--bg-1)' }}
      >
        {mounted ? (
          <Checkbox
            data-fixture-target
            defaultChecked="indeterminate"
            disabled={disabled}
            name="notification-scope"
            value="all"
            label="Select all notifications"
            hint={disabled ? 'Notification selection is unavailable.' : 'Include every notification in this selection.'}
            onStateChange={(_event, transition) => {
              if (disabled) setRequestedWhileDisabled(true)
              setLastTransition(transition)
            }}
            onValueChange={(_event, value) => {
              setCurrentState(value.indeterminate ? 'indeterminate' : value.checked)
            }}
          />
        ) : (
          <p data-fixture-empty>The notification selection is unavailable.</p>
        )}
      </form>

      <output aria-live="polite" data-fixture-state style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted
          ? String(currentState) + ', ' + (disabled ? 'disabled' : 'enabled')
          : 'Unmounted'}
      </output>

      <div aria-label="Fixture controls" data-fixture-controls style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          priority="secondary"
          data-fixture-control="disabled"
          onClick={() => {
            if (disabled) {
              setStateWhenDisabled(null)
            } else {
              setStateWhenDisabled(currentState)
              setRequestedWhileDisabled(false)
            }
            setDisabled((current) => !current)
          }}
        >
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="mounted"
          onClick={() => {
            const nextMounted = !mounted
            setLastTransition(null)
            setRequestedWhileDisabled(false)
            if (nextMounted) {
              setCurrentState('indeterminate')
              if (disabled) setStateWhenDisabled('indeterminate')
            }
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
