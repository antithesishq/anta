const selectFacetedFixture = `import { Button, SelectFaceted } from '@antadesign/anta'
import { useState } from 'react'

type Filters = {
  status?: string
  assignee?: string[]
}

const PRESETS: Filters[] = [
  { status: 'open', assignee: ['alice'] },
  { status: 'closed', assignee: ['bob', 'carol'] },
  { assignee: ['alice', 'carol'] },
  {},
]

const FIXTURE_COUNT = 5

function SelectFacetedFixture({ fixtureIndex }) {
  const [value, setValue] = useState<Filters>(PRESETS[0])
  const [disabled, setDisabled] = useState(false)
  const [bobDisabled, setBobDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)

  const facets = [
    {
      key: 'status',
      label: 'Status',
      kind: 'single' as const,
      options: [
        { value: 'open', label: 'Open' },
        { value: 'in-progress', label: 'In progress' },
        { value: 'closed', label: 'Closed' },
      ],
    },
    {
      key: 'assignee',
      label: 'Assignee',
      kind: 'multiple' as const,
      filter: true,
      options: [
        { value: 'alice', label: 'Alice' },
        { value: 'bob', label: 'Bob', disabled: bobDisabled },
        { value: 'carol', label: 'Carol' },
      ],
    },
  ]

  return (
    <section style={{ display: 'grid', alignContent: 'start', gap: '12px', padding: '20px', border: '1px solid var(--border-2)', borderRadius: '12px' }}>
      <strong>Faceted select {fixtureIndex + 1}</strong>
      <div style={{ minHeight: '240px', padding: '16px', background: 'var(--bg-1)' }}>
        {mounted ? (
          <div>
            <SelectFaceted
              data-fixture-target
              label={'Filter projects ' + (fixtureIndex + 1)}
              searchable
              disabled={disabled}
              facets={facets}
              value={value}
              onValueChange={(next) => setValue(next as Filters)}
            />
          </div>
        ) : (
          <p>The project filters are unavailable.</p>
        )}
      </div>

      <output aria-live="polite" style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted ? JSON.stringify(value) : 'Unmounted'}
      </output>

      <div aria-label="Fixture controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          priority="secondary"
          onClick={() => {
            const current = PRESETS.findIndex((preset) => JSON.stringify(preset) === JSON.stringify(value))
            setValue(PRESETS[(current + 1) % PRESETS.length])
          }}
        >
          Controlled update
        </Button>

        <Button priority="secondary" onClick={() => setDisabled((current) => !current)}>
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button priority="secondary" onClick={() => setBobDisabled((current) => !current)}>
          {bobDisabled ? 'Enable Bob' : 'Disable Bob'}
        </Button>

        <Button priority="secondary" onClick={() => setMounted((current) => !current)}>
          {mounted ? 'Unmount' : 'Mount'}
        </Button>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <main
      data-fixture="select-faceted"
      style={{ display: 'grid', width: 'min(100%, 1200px)', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}
    >
      {Array.from({ length: FIXTURE_COUNT }, (_, fixtureIndex) => (
        <SelectFacetedFixture key={fixtureIndex} fixtureIndex={fixtureIndex} />
      ))}
    </main>
  )
}
`

export default selectFacetedFixture
