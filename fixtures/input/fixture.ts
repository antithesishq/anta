const inputFixture = `import { Button, Input } from '@antadesign/anta'
import { useState } from 'react'

const VALUES = ['Anta', '', 'Hegel checks this field', 'Another controlled value']

export default function App() {
  const [value, setValue] = useState('Anta')
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [multiline, setMultiline] = useState(false)
  const [mounted, setMounted] = useState(true)

  const locked = disabled || readOnly
  const nextValue = () => VALUES[(VALUES.indexOf(value) + 1) % VALUES.length]

  return (
    <main data-fixture="input" style={{ display: 'grid', maxWidth: '640px', gap: '24px' }}>
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
            onValueChange={(_event, attrs) => setValue(attrs.value)}
          />
        ) : (
          <p>The project note is unavailable.</p>
        )}
      </div>

      <output aria-live="polite" style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted ? (value || 'Empty') + ', ' + (multiline ? 'multiline' : 'single line') : 'Unmounted'}
      </output>

      <div aria-label="Fixture controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button priority="secondary" onClick={() => setValue(nextValue())}>
          Controlled update
        </Button>

        <Button priority="secondary" onClick={() => setDisabled((current) => !current)}>
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button priority="secondary" onClick={() => setReadOnly((current) => !current)}>
          {readOnly ? 'Editable' : 'Read only'}
        </Button>

        <Button
          priority="secondary"
          onClick={() => {
            const next = !multiline
            if (!next) setValue((current) => current.replace(/\\n/g, ''))
            setMultiline(next)
          }}
        >
          {multiline ? 'Single line' : 'Multiline'}
        </Button>

        <Button priority="secondary" onClick={() => setMounted((current) => !current)}>
          {mounted ? 'Unmount' : 'Mount'}
        </Button>
      </div>
    </main>
  )
}
`

export default inputFixture
