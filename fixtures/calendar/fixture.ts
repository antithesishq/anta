const calendarFixture = `import { Button, Calendar } from '@antadesign/anta'
import { useState } from 'react'

const DATES = ['2026-06-10', '2026-06-15', '2026-06-20', '2026-07-04']

export default function App() {
  const [value, setValue] = useState('2026-06-15')
  const [disabled, setDisabled] = useState(false)
  const [narrowRange, setNarrowRange] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [valueWhenDisabled, setValueWhenDisabled] = useState<string | null>(null)
  const [requestedWhileDisabled, setRequestedWhileDisabled] = useState(false)
  const [lastTransition, setLastTransition] = useState<{ prev: string | null, next: string | null, reason: string, preApplyConsistent: boolean } | null>(null)

  const min = narrowRange ? '2026-06-10' : '2026-05-01'
  const max = narrowRange ? '2026-06-20' : '2026-08-31'

  return (
    <main
      data-fixture="calendar"
      data-expected-value={value}
      data-expected-disabled={String(disabled)}
      data-expected-mounted={String(mounted)}
      data-min={min}
      data-max={max}
      data-value-when-disabled={valueWhenDisabled ?? undefined}
      data-requested-while-disabled={String(requestedWhileDisabled)}
      data-last-prev={lastTransition?.prev ?? undefined}
      data-last-next={lastTransition?.next ?? undefined}
      data-last-reason={lastTransition?.reason}
      data-last-pre-apply-consistent={lastTransition ? String(lastTransition.preApplyConsistent) : undefined}
      style={{ display: 'grid', maxWidth: '640px', gap: '24px' }}
    >
      <div style={{ minHeight: '390px', padding: '20px', border: '1px solid var(--border-2)', borderRadius: '12px', background: 'var(--bg-1)' }}>
        {mounted ? (
          <Calendar
            data-fixture-target
            value={value}
            min={min}
            max={max}
            disabled={disabled}
            locale="en-US"
            aria-label="Release date"
            onStateChange={(event, transition) => {
              const calendar = event.currentTarget as HTMLElement & { value: string }
              if (disabled) setRequestedWhileDisabled(true)
              if (transition.reason === 'user') {
                setLastTransition({
                  ...transition,
                  preApplyConsistent: calendar.value === (transition.prev ?? ''),
                })
                if (transition.next) setValue(transition.next)
              }
            }}
          />
        ) : (
          <p data-fixture-empty>The release calendar is unavailable.</p>
        )}
      </div>

      <output aria-live="polite" data-fixture-state style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted ? value + ', ' + (disabled ? 'disabled' : 'enabled') : 'Unmounted'}
      </output>

      <div aria-label="Fixture controls" data-fixture-controls style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          priority="secondary"
          data-fixture-control="value"
          onClick={() => {
            const candidates = DATES.filter((date) => date >= min && date <= max)
            const next = candidates[(candidates.indexOf(value) + 1) % candidates.length]
            setLastTransition(null)
            setValue(next)
            if (disabled) setValueWhenDisabled(next)
          }}
        >
          Controlled update
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="disabled"
          onClick={() => {
            setLastTransition(null)
            if (disabled) setValueWhenDisabled(null)
            else {
              setValueWhenDisabled(value)
              setRequestedWhileDisabled(false)
            }
            setDisabled((current) => !current)
          }}
        >
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="range"
          onClick={() => {
            setLastTransition(null)
            const nextNarrow = !narrowRange
            if (nextNarrow && (value < '2026-06-10' || value > '2026-06-20')) {
              setValue('2026-06-15')
              if (disabled) setValueWhenDisabled('2026-06-15')
            }
            setNarrowRange(nextNarrow)
          }}
        >
          {narrowRange ? 'Use wide range' : 'Use narrow range'}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="mounted"
          onClick={() => {
            setLastTransition(null)
            setMounted((current) => !current)
          }}
        >
          {mounted ? 'Unmount' : 'Mount'}
        </Button>
      </div>
    </main>
  )
}
`

export default calendarFixture
