const checkboxFixture = `import { Button, Checkbox } from '@antadesign/anta'
import { useState } from 'react'

type CheckboxState = false | true | 'indeterminate'

const nextCheckboxState = (state: CheckboxState): CheckboxState =>
  state === false ? 'indeterminate' : state === 'indeterminate' ? true : false

export default function App() {
  const [checked, setChecked] = useState<CheckboxState>(false)
  const [disabled, setDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [lastTransition, setLastTransition] = useState<{ prev: CheckboxState, next: CheckboxState } | null>(null)

  return (
    <main
      data-fixture="checkbox"
      data-expected-checked={String(checked)}
      data-expected-disabled={String(disabled)}
      data-expected-mounted={String(mounted)}
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
            checked={checked}
            disabled={disabled}
            name="notification-scope"
            value="all"
            label="Select all notifications"
            hint={disabled ? 'Notification selection is unavailable.' : 'Include every notification in this selection.'}
            onStateChange={(_event, transition) => {
              setLastTransition(transition)
              setChecked(transition.next)
            }}
          />
        ) : (
          <p data-fixture-empty>The notification selection is unavailable.</p>
        )}
      </form>

      <output aria-live="polite" data-fixture-state style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted
          ? String(checked) + ', ' + (disabled ? 'disabled' : 'enabled')
          : 'Unmounted, parent state is ' + String(checked)}
      </output>

      <div aria-label="Fixture controls" data-fixture-controls style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          priority="secondary"
          data-fixture-control="checked"
          onClick={() => {
            setLastTransition(null)
            setChecked(nextCheckboxState)
          }}
        >
          Controlled update
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="disabled"
          onClick={() => setDisabled((current) => !current)}
        >
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="mounted"
          onClick={() => setMounted((current) => !current)}
        >
          {mounted ? 'Unmount' : 'Mount'}
        </Button>
      </div>
    </main>
  )
}
`

export default checkboxFixture
