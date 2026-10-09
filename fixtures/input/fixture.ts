const inputFixture = `import { Button, Input } from '@antadesign/anta'
import { useState } from 'react'

const VALUES = ['Anta', '', 'Hegel checks this field', 'Another controlled value']

export default function App() {
  const [value, setValue] = useState('Anta')
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [multiline, setMultiline] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [valueWhenLocked, setValueWhenLocked] = useState<string | null>(null)
  const [changedWhileLocked, setChangedWhileLocked] = useState(false)

  const locked = disabled || readOnly
  const nextValue = () => VALUES[(VALUES.indexOf(value) + 1) % VALUES.length]

  return (
    <main
      data-fixture="input"
      data-expected-value={value}
      data-expected-disabled={String(disabled)}
      data-expected-readonly={String(readOnly)}
      data-expected-multiline={String(multiline)}
      data-expected-mounted={String(mounted)}
      data-value-when-locked={valueWhenLocked ?? undefined}
      data-changed-while-locked={String(changedWhileLocked)}
      style={{ display: 'grid', maxWidth: '640px', gap: '24px' }}
    >
      <div style={{ minHeight: '128px', padding: '20px', border: '1px solid var(--border-2)', borderRadius: '12px', background: 'var(--bg-1)' }}>
        {mounted ? (
          <Input
            data-fixture-target
            label="Project note"
            hint={locked ? 'Editing is unavailable.' : 'This value is controlled by the fixture.'}
            value={value}
            disabled={disabled}
            readOnly={readOnly}
            multiline={multiline}
            maxRows={4}
            clearable
            onValueChange={(_event, attrs) => {
              if (locked) setChangedWhileLocked(true)
              setValue(attrs.value)
            }}
          />
        ) : (
          <p data-fixture-empty>The project note is unavailable.</p>
        )}
      </div>

      <output aria-live="polite" data-fixture-state style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted ? (value || 'Empty') + ', ' + (multiline ? 'multiline' : 'single line') : 'Unmounted'}
      </output>

      <div aria-label="Fixture controls" data-fixture-controls style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          priority="secondary"
          data-fixture-control="value"
          onClick={() => {
            const next = nextValue()
            setValue(next)
            if (locked) setValueWhenLocked(next)
          }}
        >
          Controlled update
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="disabled"
          onClick={() => {
            const next = !disabled
            if (next && !readOnly) {
              setValueWhenLocked(value)
              setChangedWhileLocked(false)
            } else if (!next && !readOnly) {
              setValueWhenLocked(null)
            }
            setDisabled(next)
          }}
        >
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="readonly"
          onClick={() => {
            const next = !readOnly
            if (next && !disabled) {
              setValueWhenLocked(value)
              setChangedWhileLocked(false)
            } else if (!next && !disabled) {
              setValueWhenLocked(null)
            }
            setReadOnly(next)
          }}
        >
          {readOnly ? 'Editable' : 'Read only'}
        </Button>

        <Button
          priority="secondary"
          data-fixture-control="multiline"
          onClick={() => {
            const next = !multiline
            if (!next) {
              const normalized = value.replace(/\\n/g, '')
              setValue(normalized)
              if (locked) setValueWhenLocked(normalized)
            }
            setMultiline(next)
          }}
        >
          {multiline ? 'Single line' : 'Multiline'}
        </Button>

        <Button priority="secondary" data-fixture-control="mounted" onClick={() => setMounted((current) => !current)}>
          {mounted ? 'Unmount' : 'Mount'}
        </Button>
      </div>
    </main>
  )
}
`

export default inputFixture
