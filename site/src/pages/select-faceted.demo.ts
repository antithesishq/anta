/**
 * Demo source for the SelectFaceted playground. Kept in a sibling .ts file so
 * Astro's MDX pipeline doesn't mangle the template literal's indentation.
 */
export default `import { SelectFaceted, Input } from '@antadesign/anta'

const people = [
  'Alice Nguyen', 'Bob Carter', 'Carol Diaz', 'Dave Feld', 'Erin Shah',
  'Frank Lopez', 'Grace Kim', 'Heidi Braun', 'Ivan Petrov', 'Judy Chen',
]

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
      summary: (v) => '≥ ' + v.min + 's',
      render: ({ value, onChange }) => (
        <div data-menu-open style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '4px' }}>
          <span>≥</span>
          <Input
            size="small"
            value={value?.min ?? ''}
            placeholder="0"
            style={{ width: '72px' }}
            onInput={(e) => onChange(e.currentTarget.value ? { min: e.currentTarget.value } : undefined)}
          />
          <span>seconds</span>
        </div>
      ),
    },
  ]}
  searchable
  defaultValue={{ assignee: ['Alice Nguyen'], status: 'open' }}
/>`
