const calendarFixture = `import { Button, Calendar } from '@antadesign/anta'
import { useState } from 'react'

const DATES = ['2026-06-10', '2026-06-15', '2026-06-20', '2026-07-04']

export default function App() {
  const [value, setValue] = useState('2026-06-15')
  const [disabled, setDisabled] = useState(false)
  const [narrowRange, setNarrowRange] = useState(false)
  const [mounted, setMounted] = useState(true)

  const min = narrowRange ? '2026-06-10' : '2026-05-01'
  const max = narrowRange ? '2026-06-20' : '2026-08-31'

  return (
    <main data-fixture="calendar" style={{ display: 'grid', maxWidth: '640px', gap: '24px' }}>
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
            onStateChange={(_event, transition) => {
              if (transition.reason === 'user' && transition.next) setValue(transition.next)
            }}
          />
        ) : (
          <p>The release calendar is unavailable.</p>
        )}
      </div>

      <output aria-live="polite" style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted ? value + ', ' + (disabled ? 'disabled' : 'enabled') : 'Unmounted'}
      </output>

      <div aria-label="Fixture controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          priority="secondary"
          onClick={() => {
            const candidates = DATES.filter((date) => date >= min && date <= max)
            setValue(candidates[(candidates.indexOf(value) + 1) % candidates.length])
          }}
        >
          Controlled update
        </Button>

        <Button priority="secondary" onClick={() => setDisabled((current) => !current)}>
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button
          priority="secondary"
          onClick={() => {
            const nextNarrow = !narrowRange
            if (nextNarrow && (value < '2026-06-10' || value > '2026-06-20')) setValue('2026-06-15')
            setNarrowRange(nextNarrow)
          }}
        >
          {narrowRange ? 'Use wide range' : 'Use narrow range'}
        </Button>

        <Button priority="secondary" onClick={() => setMounted((current) => !current)}>
          {mounted ? 'Unmount' : 'Mount'}
        </Button>
      </div>
    </main>
  )
}
`

export default calendarFixture
