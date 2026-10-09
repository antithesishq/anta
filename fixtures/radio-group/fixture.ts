const radioGroupFixture = `import { Button, RadioGroup } from '@antadesign/anta'
import { useState } from 'react'

export default function App() {
  const [disabled, setDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [removedValue, setRemovedValue] = useState<string | null>(null)
  const [disabledValue, setDisabledValue] = useState<string | null>(null)
  const [currentValue, setCurrentValue] = useState<string | null>('email')

  const options = [
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS', disabled: true },
    { value: 'push', label: 'Push notification' },
    { value: 'phone', label: 'Phone call' },
  ]
    .filter((option) => option.value !== removedValue)
    .map((option) => ({ ...option, disabled: option.disabled || option.value === disabledValue }))

  return (
    <main
      data-fixture="radio-group"
      style={{ display: 'grid', maxWidth: '640px', gap: '24px' }}
    >
      <div style={{ minHeight: '180px', padding: '20px', border: '1px solid var(--border-2)', borderRadius: '12px', background: 'var(--bg-1)' }}>
        {mounted ? (
          <RadioGroup
            data-fixture-target
            defaultValue="email"
            disabled={disabled}
            label="Preferred contact method"
            hint="Choose one way to receive account alerts."
            options={options}
            onValueChange={(_event, value) => setCurrentValue(value.value)}
          />
        ) : (
          <p>The contact method selection is unavailable.</p>
        )}
      </div>

      <output aria-live="polite" style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted
          ? 'Selected ' + String(currentValue) + ', ' + (disabled ? 'disabled' : 'enabled')
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
          onClick={() => setRemovedValue((current) => current === null ? currentValue : null)}
        >
          {removedValue === null ? 'Remove selected option' : 'Restore ' + removedValue}
        </Button>

        <Button
          priority="secondary"
          onClick={() => setDisabledValue((current) => current === null ? currentValue : null)}
        >
          {disabledValue === null ? 'Disable selected option' : 'Enable ' + disabledValue}
        </Button>

        <Button
          priority="secondary"
          onClick={() => {
            const nextMounted = !mounted
            if (nextMounted) setCurrentValue('email')
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

export default radioGroupFixture
