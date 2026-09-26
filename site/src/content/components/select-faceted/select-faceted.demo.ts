/**
 * Demo source for the SelectFaceted playground. Kept in a sibling .ts file so
 * Astro's MDX pipeline doesn't mangle the template literal's indentation.
 */
export default `import { SelectFaceted, Select, Input, InputDate, MenuItem, Tag } from '@antadesign/anta'

const people = [
  'Alice Nguyen', 'Bob Carter', 'Carol Diaz', 'Dave Feld', 'Erin Shah',
  'Frank Lopez', 'Grace Kim', 'Heidi Braun', 'Ivan Petrov', 'Judy Chen',
]
const presetLabels = {
  today: 'Today', yesterday: 'Yesterday', last14: 'Last 14 days', last30: 'Last 30 days',
}
const comparisons = [
  { value: 'gt', label: '>', hint: 'More than' },
  { value: 'gte', label: '≥', hint: 'At least' },
  { value: 'eq', label: '=', hint: 'Exactly' },
  { value: 'lte', label: '≤', hint: 'At most' },
  { value: 'lt', label: '<', hint: 'Less than' },
]
const sign = (comparison) => comparisons.find((option) => option.value === comparison)?.label ?? '≥'

function Demo() {
  return (
    <SelectFaceted
      facets={[
        // Long list → filterable multi-select.
        { key: 'assignee', label: 'Assignee', kind: 'multiple', icon: 'circle-dot', filter: true, options: people },
        { key: 'owner', label: 'Owner', kind: 'single', icon: 'circle-dot', filter: true, options: people },
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
        {
          key: 'metadata',
          label: 'Metadata',
          kind: 'multiple',
          icon: 'tag',
          filter: true,
          options: [
            { value: 'env:production', label: 'env: production', dataKey: 'env', dataValue: 'production' },
            { value: 'env:staging', label: 'env: staging', dataKey: 'env', dataValue: 'staging' },
            { value: 'region:us-east', label: 'region: us-east', dataKey: 'region', dataValue: 'us-east' },
            { value: 'team:platform', label: 'team: platform', dataKey: 'team', dataValue: 'platform' },
          ],
          renderOption: (option) => (
            <Tag label={String(option.dataKey)} value={String(option.dataValue)} />
          ),
        },
        {
          key: 'title',
          label: 'Title contains',
          kind: 'text',
          icon: 'case-sensitive',
          placeholder: 'Search title…',
        },
        {
          // A custom facet: its value is an object, its editor is your own.
          key: 'duration',
          label: 'Min duration',
          kind: 'custom',
          icon: 'calendar',
          summary: (v) => sign(v.comparison) + ' ' + (v.min || '…') + 's',
          render: ({ value, onChange }) => (
            <div data-menu-open style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '4px' }}>
              <Select
                size="small" aria-label="Duration comparison" options={comparisons}
                value={value?.comparison ?? 'gte'}
                onValueChange={(comparison) => onChange({ min: value?.min ?? '', comparison })}
                style={{ width: '72px' }}
              />
              <Input
                size="small"
                value={value?.min ?? ''}
                placeholder="0"
                style={{ width: '72px' }}
                onInput={(e) => onChange(e.currentTarget.value
                  ? { min: e.currentTarget.value, comparison: value?.comparison ?? 'gte' }
                  : undefined)}
              />
              <span>seconds</span>
            </div>
          ),
        },
        {
          key: 'recency',
          label: 'Recency',
          kind: 'custom',
          icon: 'calendar',
          summary: (v) => 'preset' in v ? presetLabels[v.preset] : v.from && v.to ? v.from + ' → ' + v.to : 'Custom range',
          render: ({ value, onChange }) => {
            const mode = value == null ? '' : 'preset' in value ? value.preset : 'custom'
            const range = value && 'from' in value ? value : { from: '', to: '' }
            return (
              <div style={{ minWidth: '360px' }}>
                {[
                  { value: 'today', label: 'Today' },
                  { value: 'yesterday', label: 'Yesterday' },
                  { value: 'last14', label: 'Last 14 days' },
                  { value: 'last30', label: 'Last 30 days' },
                  { value: 'custom', label: 'Custom range' },
                ].map((preset) => (
                  <MenuItem key={preset.value} label={preset.label}
                    selectionIndicator="radio" selected={mode === preset.value} data-menu-open
                    onSelect={() => onChange(preset.value === 'custom' ? range : { preset: preset.value })} />
                ))}
                {mode === 'custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', padding: '8px' }}>
                    <InputDate size="small" label="From" clearable value={range.from}
                      onValueChange={(from) => onChange({ from, to: range.to })} />
                    <InputDate size="small" label="To" clearable value={range.to} min={range.from || undefined}
                      onValueChange={(to) => onChange({ from: range.from, to })} />
                  </div>
                )}
              </div>
            )
          },
        },
      ]}
      searchable
      defaultValue={{ assignee: ['Alice Nguyen'], status: 'open' }}
    />
  )
}`
