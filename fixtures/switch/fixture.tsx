import { Button, Switch } from '@antadesign/anta'
import { useState } from 'preact/hooks'

export default function SwitchFixture() {
  const [checked, setChecked] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)

  return (
    <main
      data-fixture="switch"
      data-expected-checked={String(checked)}
      data-expected-disabled={String(disabled)}
      data-expected-mounted={String(mounted)}
    >
      <form data-fixture-form>
        {mounted ? (
          <Switch
            data-fixture-target
            checked={checked}
            disabled={disabled}
            name="automatic-updates"
            value="enabled"
            label="Automatic updates"
            hint={disabled ? 'Managed by your organization.' : 'Install updates automatically.'}
            onStateChange={(_event, { next }) => setChecked(next)}
          />
        ) : (
          <p data-fixture-empty>The automatic update setting is unavailable.</p>
        )}
      </form>

      <output aria-live="polite" data-fixture-state>
        {mounted
          ? `${checked ? 'On' : 'Off'}, ${disabled ? 'locked' : 'editable'}`
          : `Removed, parent value is ${checked ? 'on' : 'off'}`}
      </output>

      <div aria-label="Fixture controls" data-fixture-controls>
        <Button
          priority="secondary"
          data-fixture-control="checked"
          onClick={() => setChecked((value) => !value)}
        >
          {checked ? 'Turn off from parent' : 'Turn on from parent'}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="disabled"
          onClick={() => setDisabled((value) => !value)}
        >
          {disabled ? 'Unlock setting' : 'Lock setting'}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="mounted"
          onClick={() => setMounted((value) => !value)}
        >
          {mounted ? 'Remove setting' : 'Restore setting'}
        </Button>
      </div>
    </main>
  )
}

