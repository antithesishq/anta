import { useEffect, useState } from 'preact/hooks'
import { SelectFaceted, Select, Input } from '@antadesign/anta'
import type { SelectFacet } from '@antadesign/anta'

/** Registers the custom elements client-side (see TabsDemo for the pattern). */
function useElements() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])
}

const PEOPLE = [
  'Alice Nguyen', 'Bob Carter', 'Carol Diaz', 'Dave Feld', 'Erin Shah',
  'Frank Lopez', 'Grace Kim', 'Heidi Braun', 'Ivan Petrov', 'Judy Chen',
  'Karl Ober', 'Liz Moreau',
]

const FACETS: SelectFacet[] = [
  // Long list → filterable multi-select.
  { key: 'assignee', label: 'Assignee', kind: 'multiple', icon: 'circle-dot', filter: true, options: PEOPLE },
  // Same list under a different facet — "alice" here never collides with an assignee "alice".
  { key: 'owner', label: 'Owner', kind: 'single', icon: 'circle-dot', filter: true, options: PEOPLE },
  // Options carry the same fields as Select's — value / label / hint / tone.
  {
    key: 'status',
    label: 'Status',
    kind: 'single',
    icon: 'tag',
    options: [
      { value: 'open', label: 'Open', hint: 'Not started' },
      { value: 'in-progress', label: 'In progress', hint: 'Being worked on' },
      { value: 'closed', label: 'Closed', hint: 'Done' },
    ],
  },
  {
    key: 'label',
    label: 'Label',
    kind: 'multiple',
    options: [
      { value: 'bug', label: 'Bug', tone: 'critical' },
      { value: 'feature', label: 'Feature', tone: 'success' },
      { value: 'docs', label: 'Docs', tone: 'info' },
      { value: 'chore', label: 'Chore' },
    ],
  },
  { key: 'title', label: 'Title contains', kind: 'text', icon: 'case-sensitive', placeholder: 'Search title…' },
  {
    // A custom facet: object value, your own editor.
    key: 'duration',
    label: 'Min duration',
    kind: 'custom',
    icon: 'calendar',
    summary: (v: any) => `≥ ${v.min}s`,
    render: ({ value, onChange }: any) => (
      <div data-menu-open style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '4px' }}>
        <span>≥</span>
        <Input
          size="small"
          value={value?.min ?? ''}
          placeholder="0"
          style={{ width: '72px' }}
          onInput={(e: any) => onChange(e.currentTarget.value ? { min: e.currentTarget.value } : undefined)}
        />
        <span>seconds</span>
      </div>
    ),
  },
]

const isSet = (v: unknown) => !(v == null || v === '' || (Array.isArray(v) && v.length === 0))

export function SelectFacetedBasicDemo() {
  useElements()
  const [value, setValue] = useState<Record<string, unknown>>({ assignee: ['Alice Nguyen'], status: 'open' })
  const setFacet = (key: string, v: unknown) =>
    setValue((prev) => {
      const next = { ...prev }
      if (isSet(v)) next[key] = v
      else delete next[key]
      return next
    })
  const active = FACETS.filter((f) => isSet(value[f.key]))
  return (
    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '12px', alignItems: 'center', width: '100%' }}>
      <SelectFaceted facets={FACETS} value={value} onValueChange={setValue} searchable />
      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {active.map((facet) => {
            // Options facets → an editable Select; the key rides the leading slot.
            if (facet.kind === 'single' || facet.kind === 'multiple')
              return (
                <Select
                  key={facet.key}
                  selection={facet.kind}
                  options={facet.options}
                  value={value[facet.key] as any}
                  onValueChange={(v: any) => setFacet(facet.key, v)}
                  leading={`${facet.label}:`}
                  className="sf-chip"
                />
              )
            // Free-form text → an editable Input; clearing it drops the filter.
            if (facet.kind === 'text')
              return (
                <Input
                  key={facet.key}
                  value={(value[facet.key] as string) ?? ''}
                  leading={`${facet.label}:`}
                  clearable
                  className="sf-chip"
                  onInput={(e: any) => setFacet(facet.key, e.currentTarget.value || undefined)}
                />
              )
            // Custom (duration) → an Input editing its `min`.
            return (
              <Input
                key={facet.key}
                value={((value[facet.key] as any)?.min ?? '') as string}
                leading={`${facet.label}:`}
                clearable
                className="sf-chip"
                onInput={(e: any) =>
                  setFacet(facet.key, e.currentTarget.value ? { min: e.currentTarget.value } : undefined)
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
