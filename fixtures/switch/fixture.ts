const switchFixture = `import { Button, Switch } from '@antadesign/anta'
import { useState } from 'react'

export default function App() {
  const [checked, setChecked] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)

  return (
    <main
      data-fixture="switch"
      data-expected-checked={String(checked)}
      data-expected-disabled={String(disabled)}
      data-expected-mounted={String(mounted)}
      style={{ display: 'grid', maxWidth: '640px', gap: '24px' }}
    >
      <div
        style={{ minHeight: '72px', padding: '20px', border: '1px solid var(--border-2)', borderRadius: '12px', background: 'var(--bg-1)' }}
      >
        {mounted ? (
          <Switch
            data-fixture-target
            checked={checked}
            disabled={disabled}
            label="Automatic updates"
            hint={disabled ? 'Managed by your organization.' : 'Install updates automatically.'}
            onStateChange={(_event, { next }) => setChecked(next)}
          />
        ) : (
          <p data-fixture-empty>The automatic update setting is unavailable.</p>
        )}
      </div>

      <output aria-live="polite" data-fixture-state style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted
          ? (checked ? 'On' : 'Off') + ', ' + (disabled ? 'locked' : 'editable')
          : 'Removed, parent value is ' + (checked ? 'on' : 'off')}
      </output>

      <div aria-label="Fixture controls" data-fixture-controls style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          priority="secondary"
          data-fixture-control="checked"
          onClick={() => setChecked((value) => !value)}
        >
          Controlled update
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="disabled"
          onClick={() => setDisabled((value) => !value)}
        >
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="mounted"
          onClick={() => setMounted((value) => !value)}
        >
          {mounted ? 'Unmount' : 'Mount'}
        </Button>
      </div>
    </main>
  )
}
`

export default switchFixture
