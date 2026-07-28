import { useEffect, useState } from 'preact/hooks'
import { SelectFaceted, Select, Input, Button, RadioGroup, InputDate, Calendar, MenuItem } from '@antadesign/anta'
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
  const [value, setValue] = useState<Record<string, unknown>>({ assignee: ['Alice Nguyen'], status: 'open', title: 'crash' })
  const setFacet = (key: string, v: unknown) =>
    setValue((prev) => {
      const next = { ...prev }
      if (isSet(v)) next[key] = v
      else delete next[key]
      return next
    })
  // Keep a text/custom result chip mounted while it's focused, even if emptied — so
  // backspacing to empty doesn't yank the field mid-edit (only the Clear button or
  // blurring an empty field removes it).
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const active = FACETS.filter((f) => isSet(value[f.key]) || f.key === focusedKey)
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
                  indicator={facet.kind === 'single' ? 'check' : undefined}
                  options={facet.options}
                  value={value[facet.key] as any}
                  onValueChange={(v: any) => setFacet(facet.key, v)}
                  leading={`${facet.label}:`}
                  filter={facet.filter}
                  clearable
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
                  dimActions
                  className="sf-chip"
                  onFocus={() => setFocusedKey(facet.key)}
                  onBlur={() => setFocusedKey(null)}
                  onInput={(e: any) => setFacet(facet.key, e.currentTarget.value || undefined)}
                  onClearInput={() => {
                    setFocusedKey(null)
                    setFacet(facet.key, undefined)
                  }}
                />
              )
            // Custom (duration) → an Input editing its `min`.
            return (
              <Input
                key={facet.key}
                value={((value[facet.key] as any)?.min ?? '') as string}
                leading={`${facet.label}:`}
                clearable
                dimActions
                className="sf-chip"
                onFocus={() => setFocusedKey(facet.key)}
                onBlur={() => setFocusedKey(null)}
                onInput={(e: any) =>
                  setFacet(facet.key, e.currentTarget.value ? { min: e.currentTarget.value } : undefined)
                }
                onClearInput={() => {
                  setFocusedKey(null)
                  setFacet(facet.key, undefined)
                }}
              />
            )
          })}
          {active.length > 1 && (
            // Once more than one result is showing, a single control resets them
            // all — pushed to the right of the last chip.
            <Button
              priority="tertiary"
              icon="filter-x"
              label="Clear all"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                setFocusedKey(null)
                setValue({})
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// --- Recency: presets + a custom date range, in one custom facet -----------

// The facet's value: a chosen preset, or a concrete { from, to } range.
type Recency = { preset: 'today' | 'yesterday' | 'last14' | 'last30' } | { from: string; to: string }

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last14', label: 'Last 14 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
]
const PRESET_LABELS: Record<string, string> = {
  today: 'Today', yesterday: 'Yesterday', last14: 'Last 14 days', last30: 'Last 30 days',
}

// Local ISO YYYY-MM-DD (what InputDate speaks).
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n: number) => {
  const x = new Date()
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - n)
  return x
}

// Resolve any Recency to a concrete { from, to } — this is what you'd filter rows with.
const resolveRange = (r: Recency): { from: string; to: string } => {
  if ('from' in r) return r
  const today = isoDay(daysAgo(0))
  switch (r.preset) {
    case 'today': return { from: today, to: today }
    case 'yesterday': { const y = isoDay(daysAgo(1)); return { from: y, to: y } }
    case 'last14': return { from: isoDay(daysAgo(13)), to: today }
    case 'last30': return { from: isoDay(daysAgo(29)), to: today }
  }
}

const RECENCY_FACETS: SelectFacet[] = [
  {
    key: 'recency',
    label: 'Recency',
    kind: 'custom',
    icon: 'calendar',
    // The row chip: the preset's label, or the picked range.
    summary: (v: any) =>
      'preset' in v ? PRESET_LABELS[v.preset] : v.from && v.to ? `${v.from} → ${v.to}` : 'Custom range',
    // Presets plus — when "Custom range" is picked — two InputDate fields, all in
    // the flyout. Each InputDate opens its own calendar in its own menu, which now
    // stacks on top of this flyout (the flyout stays open) rather than fighting it.
    render: ({ value, onChange }: any) => {
      const v = value as Recency | undefined
      const mode = v == null ? '' : 'preset' in v ? v.preset : 'custom'
      const range = v && 'from' in v ? v : { from: '', to: '' }
      return (
        <div data-menu-open style={{ padding: '8px', minWidth: '190px', display: 'grid', gap: '8px' }}>
          <RadioGroup
            size="small"
            options={PRESETS}
            value={mode}
            // Controlled: apply the pick in onStateChange (onValueChange fires only
            // after `value` changes, so it can't drive a controlled group).
            onStateChange={(_e: any, { next }: any) =>
              onChange(next === 'custom' ? (v && 'from' in v ? v : { from: '', to: '' }) : { preset: next })
            }
          />
          {mode === 'custom' && (
            <div style={{ display: 'grid', gap: '6px' }}>
              <InputDate
                size="small"
                label="From"
                value={range.from}
                onValueChange={(from: string) => onChange({ from, to: range.to })}
              />
              <InputDate
                size="small"
                label="To"
                value={range.to}
                min={range.from || undefined}
                onValueChange={(to: string) => onChange({ from: range.from, to })}
              />
            </div>
          )}
        </div>
      )
    },
  },
]

export function SelectFacetedRecencyDemo() {
  useElements()
  const [value, setValue] = useState<Record<string, unknown>>({ recency: { preset: 'last14' } })
  const recency = value.recency as Recency | undefined
  const resolved = recency ? resolveRange(recency) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', width: '100%' }}>
      <SelectFaceted facets={RECENCY_FACETS} value={value} onValueChange={setValue} />
      <span style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
        {resolved ? `Filtering ${resolved.from} → ${resolved.to}` : 'No recency filter'}
      </span>
    </div>
  )
}

// --- Min duration: a number, edited by a plain Input inside the flyout --------
// An Input has no popup of its own, so it lives directly in the custom facet.

const DURATION_FACETS: SelectFacet[] = [
  {
    key: 'duration',
    label: 'Min duration',
    kind: 'custom',
    summary: (v: any) => `≥ ${v}s`,
    render: ({ value, onChange }: any) => (
      <div data-menu-open style={{ padding: '8px' }}>
        <Input
          // Controlled numeric field: type="text" + inputMode, not type="number"
          // (which sanitizes "1." / "1.0" to empty). Store the raw string, parse below.
          type="text"
          inputMode="decimal"
          size="small"
          placeholder="seconds"
          style={{ width: '120px' }}
          value={(value as string | undefined) ?? ''}
          onInput={(e: any) => onChange(e.currentTarget.value || undefined)}
        />
      </div>
    ),
  },
]

export function SelectFacetedDurationDemo() {
  useElements()
  const [value, setValue] = useState<Record<string, unknown>>({})
  const raw = value.duration as string | undefined
  const seconds = raw != null && raw.trim() !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', width: '100%' }}>
      <SelectFaceted facets={DURATION_FACETS} value={value} onValueChange={setValue} />
      <span style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
        {seconds != null ? `≥ ${seconds}s` : 'No duration filter'}
      </span>
    </div>
  )
}

// --- Created after: a Date, edited by the inline Calendar grid inside the flyout.
// Calendar renders in place; picking a day fires its own onStateChange. Two helpers
// bridge Calendar's ISO strings and the Date we store.

const toISODay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromISODay = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : undefined)

const DATE_FACETS: SelectFacet[] = [
  {
    key: 'since',
    label: 'Created after',
    kind: 'custom',
    icon: 'calendar',
    summary: (v: any) => (v as Date).toLocaleDateString(),
    render: ({ value, onChange }: any) => (
      <div data-menu-open style={{ padding: '4px' }}>
        <Calendar
          size="small"
          value={value ? toISODay(value) : ''}
          // Controlled: apply the pick in onStateChange (onValueChange fires only
          // after value changes). Cast the ISO string to the Date we store.
          onStateChange={(_e: any, { next }: any) => onChange(fromISODay(next))}
        />
      </div>
    ),
  },
]

export function SelectFacetedDateDemo() {
  useElements()
  const [value, setValue] = useState<Record<string, unknown>>({})
  const since = value.since as Date | undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', width: '100%' }}>
      <SelectFaceted facets={DATE_FACETS} value={value} onValueChange={setValue} />
      <span style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
        {since ? `Created after ${since.toLocaleDateString()}` : 'No date filter'}
      </span>
    </div>
  )
}

// --- Recency, menu-item variant: presets as MenuItems, plus a single "Custom day"
// whose InputDate calendar opens to the right (placement="right-start").

type RecencyDay = { preset: 'today' | 'yesterday' | 'last14' | 'last30' } | { day: string }

const DAY_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last14', label: 'Last 14 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom day' },
]

const RECENCY_MENU_FACETS: SelectFacet[] = [
  {
    key: 'recency',
    label: 'Recency',
    kind: 'custom',
    icon: 'calendar',
    summary: (v: any) => ('preset' in v ? PRESET_LABELS[v.preset] : v.day || 'Custom day'),
    render: ({ value, onChange }: any) => {
      const v = value as RecencyDay | undefined
      const mode = v == null ? '' : 'preset' in v ? v.preset : 'custom'
      const day = v && 'day' in v ? v.day : ''
      return (
        <>
          {DAY_PRESETS.map((p) => (
            <MenuItem
              key={p.value}
              label={p.label}
              selectionIndicator="check"
              selected={mode === p.value}
              data-menu-open=""
              onSelect={() => onChange(p.value === 'custom' ? (v && 'day' in v ? v : { day: '' }) : { preset: p.value })}
            />
          ))}
          {mode === 'custom' && (
            <div data-menu-open="" style={{ padding: '8px' }}>
              {/* placement="right-start" opens the calendar to the right of the field */}
              <InputDate
                size="small"
                label="Day"
                placement="right-start"
                value={day}
                onValueChange={(d: string) => onChange({ day: d })}
              />
            </div>
          )}
        </>
      )
    },
  },
]

export function SelectFacetedRecencyMenuDemo() {
  useElements()
  const [value, setValue] = useState<Record<string, unknown>>({ recency: { preset: 'last14' } })
  const v = value.recency as RecencyDay | undefined
  let readout = 'No recency filter'
  if (v && 'preset' in v) {
    const r = resolveRange({ preset: v.preset } as Recency)
    readout = `Filtering ${r.from} → ${r.to}`
  } else if (v && 'day' in v) {
    readout = v.day ? `On ${v.day}` : 'Pick a day'
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', width: '100%' }}>
      <SelectFaceted facets={RECENCY_MENU_FACETS} value={value} onValueChange={setValue} />
      <span style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>{readout}</span>
    </div>
  )
}

