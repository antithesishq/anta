const radioGroupFixture = `import { Button, RadioGroup } from '@antadesign/anta'
import { useState } from 'react'

type Transition = {
  prev: string | null
  next: string | null
  reason: string
  prevMatched: boolean
  targetWasEnabled: boolean
}

export default function App() {
  const [disabled, setDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [includeEmail, setIncludeEmail] = useState(true)
  const [currentValue, setCurrentValue] = useState<string | null>('email')
  const [valueWhenDisabled, setValueWhenDisabled] = useState<string | null>(null)
  const [requestedWhileDisabled, setRequestedWhileDisabled] = useState(false)
  const [lastTransition, setLastTransition] = useState<Transition | null>(null)

  const options = [
    ...(includeEmail ? [{ value: 'email', label: 'Email' }] : []),
    { value: 'sms', label: 'SMS', disabled: true },
    { value: 'push', label: 'Push notification' },
    { value: 'phone', label: 'Phone call' },
  ]

  return (
    <main
      data-fixture="radio-group"
      data-expected-disabled={String(disabled)}
      data-expected-mounted={String(mounted)}
      data-last-prev={lastTransition?.prev ?? undefined}
      data-last-next={lastTransition?.next ?? undefined}
      data-last-reason={lastTransition?.reason}
      data-last-prev-matched={lastTransition ? String(lastTransition.prevMatched) : undefined}
      data-last-target-enabled={lastTransition ? String(lastTransition.targetWasEnabled) : undefined}
      data-requested-while-disabled={String(requestedWhileDisabled)}
      data-value-when-disabled={valueWhenDisabled ?? undefined}
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
            onStateChange={(_event, transition) => {
              if (disabled) setRequestedWhileDisabled(true)
              if (transition.reason === 'user') {
                setLastTransition({
                  ...transition,
                  prevMatched: transition.prev === currentValue,
                  targetWasEnabled: options.some((option) => option.value === transition.next && !option.disabled),
                })
              }
            }}
            onValueChange={(_event, value) => setCurrentValue(value.value)}
          />
        ) : (
          <p data-fixture-empty>The contact method selection is unavailable.</p>
        )}
      </div>

      <output aria-live="polite" data-fixture-state style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted
          ? 'Selected ' + String(currentValue) + ', ' + (disabled ? 'disabled' : 'enabled')
          : 'Unmounted'}
      </output>

      <div aria-label="Fixture controls" data-fixture-controls style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          priority="secondary"
          data-fixture-control="disabled"
          onClick={() => {
            if (disabled) {
              setValueWhenDisabled(null)
            } else {
              setValueWhenDisabled(currentValue)
              setRequestedWhileDisabled(false)
            }
            setDisabled((current) => !current)
          }}
        >
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="email"
          onClick={() => setIncludeEmail((current) => !current)}
        >
          {includeEmail ? 'Remove Email' : 'Add Email'}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="mounted"
          onClick={() => {
            const nextMounted = !mounted
            setLastTransition(null)
            setRequestedWhileDisabled(false)
            if (nextMounted) {
              setCurrentValue('email')
              if (disabled) setValueWhenDisabled('email')
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

export default radioGroupFixture
