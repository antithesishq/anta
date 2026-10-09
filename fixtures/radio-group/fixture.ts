const radioGroupFixture = `import { Button, RadioGroup } from '@antadesign/anta'
import { useState } from 'react'

type Transition = {
  prev: string | null
  next: string | null
  reason: string
  prevMatched: boolean
  preApplyConsistent: boolean
  targetWasEnabled: boolean
}

function selectionMatches(group: HTMLElement & { value: string | null }, value: string | null) {
  const radios = Array.from(group.querySelectorAll<HTMLElement & { selected: boolean }>('a-radio'))
  const matchingOptionExists = value !== null && radios.some((radio) => radio.getAttribute('value') === value)
  const selected = radios.filter((radio) => radio.selected)
  const selectedStates = radios.filter((radio) => radio.matches(':state(selected)'))
  const expectedCount = matchingOptionExists ? 1 : 0

  return group.value === value
    && selected.length === expectedCount
    && selectedStates.length === expectedCount
    && selected.every((radio) => radio.getAttribute('value') === value)
    && selectedStates.every((radio) => radio.getAttribute('value') === value)
}

export default function App() {
  const [disabled, setDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [removedValue, setRemovedValue] = useState<string | null>(null)
  const [disabledValue, setDisabledValue] = useState<string | null>(null)
  const [currentValue, setCurrentValue] = useState<string | null>('email')
  const [observedValue] = useState(() => ({ current: 'email' as string | null }))
  const [valueWhenDisabled, setValueWhenDisabled] = useState<string | null>(null)
  const [requestedWhileDisabled, setRequestedWhileDisabled] = useState(false)
  const [lastTransition, setLastTransition] = useState<Transition | null>(null)
  const [postApplyConsistent, setPostApplyConsistent] = useState<boolean | null>(null)

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
      data-expected-disabled={String(disabled)}
      data-expected-mounted={String(mounted)}
      data-last-prev={lastTransition?.prev ?? undefined}
      data-last-next={lastTransition?.next ?? undefined}
      data-last-reason={lastTransition?.reason}
      data-last-prev-matched={lastTransition ? String(lastTransition.prevMatched) : undefined}
      data-last-pre-apply-consistent={lastTransition ? String(lastTransition.preApplyConsistent) : undefined}
      data-last-target-enabled={lastTransition ? String(lastTransition.targetWasEnabled) : undefined}
      data-post-apply-consistent={postApplyConsistent === null ? undefined : String(postApplyConsistent)}
      data-removed-value={removedValue ?? undefined}
      data-disabled-option-value={disabledValue ?? undefined}
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
            onStateChange={(event, transition) => {
              if (disabled) setRequestedWhileDisabled(true)
              if (transition.reason === 'user') {
                const group = event.currentTarget as HTMLElement & { value: string | null }
                setLastTransition({
                  ...transition,
                  prevMatched: transition.prev === observedValue.current,
                  preApplyConsistent: selectionMatches(group, transition.prev),
                  targetWasEnabled: options.some((option) => option.value === transition.next && !option.disabled),
                })
              }
            }}
            onValueChange={(event, value) => {
              const group = event.currentTarget as HTMLElement & { value: string | null }
              setPostApplyConsistent(selectionMatches(group, value.value))
              observedValue.current = value.value
              setCurrentValue(value.value)
            }}
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
          data-fixture-control="options"
          onClick={() => setRemovedValue((current) => current === null ? currentValue : null)}
        >
          {removedValue === null ? 'Remove selected option' : 'Restore ' + removedValue}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="option-disabled"
          onClick={() => setDisabledValue((current) => current === null ? currentValue : null)}
        >
          {disabledValue === null ? 'Disable selected option' : 'Enable ' + disabledValue}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="mounted"
          onClick={() => {
            const nextMounted = !mounted
            setLastTransition(null)
            setPostApplyConsistent(null)
            setRequestedWhileDisabled(false)
            if (nextMounted) {
              observedValue.current = 'email'
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
