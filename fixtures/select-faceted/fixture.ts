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

export default function App() {
  const [value, setValue] = useState<Filters>(PRESETS[0])
  const [disabled, setDisabled] = useState(false)
  const [bobDisabled, setBobDisabled] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [lastChangeValid, setLastChangeValid] = useState(true)

  const facets = [
    {
      key: 'status',
      label: 'Status',
      kind: 'single' as const,
      options: [
        { value: 'open', label: 'Open', 'data-fixture-facet': 'status', 'data-fixture-value': 'open', 'data-fixture-search': 'open' },
        { value: 'in-progress', label: 'In progress', 'data-fixture-facet': 'status', 'data-fixture-value': 'in-progress', 'data-fixture-search': 'in progress' },
        { value: 'closed', label: 'Closed', 'data-fixture-facet': 'status', 'data-fixture-value': 'closed', 'data-fixture-search': 'closed' },
      ],
    },
    {
      key: 'assignee',
      label: 'Assignee',
      kind: 'multiple' as const,
      filter: true,
      options: [
        { value: 'alice', label: 'Alice', 'data-fixture-facet': 'assignee', 'data-fixture-value': 'alice', 'data-fixture-search': 'alice' },
        { value: 'bob', label: 'Bob', disabled: bobDisabled, 'data-fixture-facet': 'assignee', 'data-fixture-value': 'bob', 'data-fixture-search': 'bob' },
        { value: 'carol', label: 'Carol', 'data-fixture-facet': 'assignee', 'data-fixture-value': 'carol', 'data-fixture-search': 'carol' },
      ],
    },
  ]

  const activeCount = Number(value.status !== undefined) + Number((value.assignee?.length ?? 0) > 0)

  return (
    <main
      data-fixture="select-faceted"
      data-expected-value={JSON.stringify(value)}
      data-expected-active-count={String(activeCount)}
      data-expected-disabled={String(disabled)}
      data-expected-mounted={String(mounted)}
      data-last-change-valid={String(lastChangeValid)}
      style={{ display: 'grid', maxWidth: '640px', gap: '24px' }}
    >
      <div style={{ minHeight: '240px', padding: '20px', border: '1px solid var(--border-2)', borderRadius: '12px', background: 'var(--bg-1)' }}>
        {mounted ? (
          <div data-select-faceted-host>
            <SelectFaceted
              data-fixture-target
              label="Filter projects"
              searchable
              disabled={disabled}
              facets={facets}
              value={value}
              onValueChange={(next, attrs) => {
                const candidate = next as Filters
                const changedFacetIsValid = 'all' in attrs
                  ? Object.keys(candidate).length === 0
                  : attrs.facet === 'status'
                    ? candidate.status === attrs.value || (attrs.value === undefined && candidate.status === undefined)
                    : attrs.facet === 'assignee'
                      ? JSON.stringify(candidate.assignee) === JSON.stringify(attrs.value)
                      : false
                setLastChangeValid(changedFacetIsValid)
                setValue(candidate)
              }}
            />
          </div>
        ) : (
          <p data-fixture-empty>The project filters are unavailable.</p>
        )}
      </div>

      <output aria-live="polite" data-fixture-state style={{ color: 'var(--text-2)', fontSize: '14px' }}>
        {mounted ? JSON.stringify(value) : 'Unmounted'}
      </output>

      <div aria-label="Fixture controls" data-fixture-controls style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button
          priority="secondary"
          data-fixture-control="value"
          onClick={() => {
            const current = PRESETS.findIndex((preset) => JSON.stringify(preset) === JSON.stringify(value))
            setValue(PRESETS[(current + 1) % PRESETS.length])
            setLastChangeValid(true)
          }}
        >
          Controlled update
        </Button>

        <Button priority="secondary" data-fixture-control="disabled" onClick={() => setDisabled((current) => !current)}>
          {disabled ? 'Enable' : 'Disable'}
        </Button>

        <Button priority="secondary" data-fixture-control="option-disabled" onClick={() => setBobDisabled((current) => !current)}>
          {bobDisabled ? 'Enable Bob' : 'Disable Bob'}
        </Button>

        <Button priority="secondary" data-fixture-control="mounted" onClick={() => setMounted((current) => !current)}>
          {mounted ? 'Unmount' : 'Mount'}
        </Button>
      </div>
    </main>
  )
}
`

export default selectFacetedFixture
