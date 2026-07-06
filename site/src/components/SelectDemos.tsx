import { useEffect, useState } from 'preact/hooks'
import { Select, Tooltip, Tag, Button, Icon, MenuItem, MenuSeparator, Checkbox } from '@antadesign/anta'
import type { SelectOption } from '@antadesign/anta'

/**
 * Hydrated island demos for the Select docs. Select is a *composed wrapper*
 * (no coordinating element), so its interactivity lives in Preact. A static
 * <Preview> would render the field but couldn't update on selection, so these
 * small `client:load` islands hydrate to make the previews interactive.
 */
const useElements = () =>
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

const FIELDS: SelectOption[] = [
  { value: 'output_text', label: 'output_text', hint: 'Raw log message or event payload', icon: 'file' },
  { value: 'stream', label: 'stream', hint: 'Log level: error · info · internal', icon: 'braces' },
  { value: 'container', label: 'container', hint: 'Host where the event occurred', icon: 'cube' },
  { value: 'archived', label: 'archived', hint: 'Read-only snapshot', icon: 'folder-close', disabled: true },
  { value: 'flagged', label: 'flagged', hint: 'Needs review', icon: 'warning-triangle', tone: 'warning' },
  { value: 'custom', label: 'custom', hint: 'Your own field path', icon: 'asterisk', tone: '#c026d3' },
]

export function SelectOptionsDemo() {
  useElements()
  const [value, setValue] = useState('stream')
  return (
    <div style={{ width: '260px' }}>
      <Select label="Field" options={FIELDS} value={value} onValueChange={setValue} />
    </div>
  )
}

// Mixed tree: a flat option, an inline group (level 1), a submenu (level 1) that
// itself holds a group (level 2) and a nested submenu (level 2 → its options level 3),
// and a disabled submenu (cascades to its children).
const GROUPED = [
  'output_text',
  { label: 'Log', options: ['stream', 'message', 'severity'] },
  {
    label: 'Metadata',
    icon: 'braces',
    submenu: [
      'metadata.host',
      'metadata.region',
      { label: 'Tags', options: ['tag.env', 'tag.team'] },
      { label: 'Custom', submenu: ['custom.a', 'custom.b'] },
    ],
  },
  { label: 'Time', submenu: ['vtime', 'wall_clock'], disabled: true },
]

export function SelectGroupsDemo() {
  useElements()
  const [one, setOne] = useState('stream')
  const [many, setMany] = useState<string[]>(['stream', 'tag.env'])
  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ width: '240px' }}>
        <Select label="Field · single" filter options={GROUPED} value={one} onValueChange={setOne} />
      </div>
      <div style={{ width: '240px' }}>
        <Select label="Fields · multiple" selection="multiple" filter options={GROUPED} value={many} onValueChange={setMany} />
      </div>
    </div>
  )
}

export function SelectBasicDemo() {
  useElements()
  const [value, setValue] = useState('stream')
  return (
    <div style={{ width: '240px' }}>
      <Select
        options={['output_text', 'stream', 'container']}
        value={value}
        onValueChange={setValue}
        placeholder="Select a field…"
      />
    </div>
  )
}

export function SelectModesDemo() {
  useElements()
  const [check, setCheck] = useState('stream')
  const [radio, setRadio] = useState('stream')
  const [checks, setChecks] = useState<string[]>(['stream', 'container'])
  const opts = ['output_text', 'stream', 'container', 'vtime', 'custom']
  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ width: '220px' }}>
        <Select
          label="Checkmark · brand tone"
          indicator="check"
          toneSelected="brand"
          options={opts}
          value={check}
          onValueChange={setCheck}
        />
      </div>
      <div style={{ width: '220px' }}>
        <Select
          label="Radio · custom tone"
          indicator="radio"
          toneSelected="#c026d3"
          options={opts}
          value={radio}
          onValueChange={setRadio}
        />
      </div>
      <div style={{ width: '220px' }}>
        <Select
          label="Multiple · brand tone"
          selection="multiple"
          selectAll
          toneSelected="brand"
          placeholder="Select fields…"
          options={opts}
          value={checks}
          onValueChange={setChecks}
        />
      </div>
    </div>
  )
}

export function SelectSizeStatusDemo() {
  useElements()
  const opts = ['output_text', 'stream', 'container', 'vtime']
  const box = { width: '220px' }
  return (
    <div style={{ display: 'flex', gap: '20px 24px', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={box}>
        <Select label="Small · info" size="small" status="info" hint="Lowercase & dashes only" options={opts} defaultValue="stream" />
      </div>
      <div style={box}>
        <Select label="Medium · success" size="medium" status="success" hint="Field is valid" options={opts} defaultValue="stream" />
      </div>
      <div style={box}>
        <Select label="Large · warning" size="large" status="warning" hint="Deprecated field" options={opts} defaultValue="stream" />
      </div>
      <div style={box}>
        <Select label="Large · critical" size="large" status="critical" hint="Pick a field" options={opts} placeholder="Required…" />
      </div>
      <div style={box}>
        <Select label="Small · custom icon" size="small" status="info" statusIcon="sparkles" hint="statusIcon override" options={opts} defaultValue="stream" />
      </div>
    </div>
  )
}

const FILTER_OPTS: SelectOption[] = [
  { value: 'output_text', hint: 'Raw log message or event payload' },
  { value: 'stream', hint: 'Log level: error · info · internal' },
  { value: 'container', hint: 'Host where the event occurred' },
  { value: 'vtime', hint: 'Simulation time in seconds' },
  { value: 'source', hint: 'Emitting system or process' },
  { value: 'message', hint: 'Assertion description' },
  { value: 'condition', hint: 'Passing or failing' },
  { value: 'fault', hint: 'Injected fault type and name' },
]

export function SelectFilterDemo() {
  useElements()
  const [one, setOne] = useState('stream')
  const [many, setMany] = useState<string[]>(['stream'])
  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ width: '240px' }}>
        <Select label="Single · filter" filter indicator="check" options={FILTER_OPTS} value={one} onValueChange={setOne} />
      </div>
      <div style={{ width: '240px' }}>
        <Select label="Multiple · filter" selection="multiple" filter selectAll placeholder="Fields…" options={FILTER_OPTS} value={many} onValueChange={setMany} />
      </div>
    </div>
  )
}

// A list of test runs. Each option carries its own `name` / `ranAt` / `status`
// (allowed by SelectOption's index signature), read back in `renderOption`.
type RunStatus = 'in_progress' | 'completed' | 'incomplete'
type Run = SelectOption & { name: string; ranAt: string; status: RunStatus }
const RUN_TONE: Record<RunStatus, 'info' | 'neutral' | 'critical'> = {
  in_progress: 'info',
  completed: 'neutral',
  incomplete: 'critical',
}
const RUN_LABEL: Record<RunStatus, string> = {
  in_progress: 'In progress',
  completed: 'Completed',
  incomplete: 'Incomplete',
}
// `label` = the run name so the closed trigger reads it. renderOption styles the
// menu rows; the rich row layout below comes from it.
const RUNS: Run[] = [
  { value: 'r-8842', name: 'nightly-regression-full-matrix — shard 14 of 32', ranAt: 'Today 11:00 AM', status: 'in_progress' },
  { value: 'r-8841', name: 'pr-4821-merge-gate', ranAt: 'Today 9:42 AM', status: 'completed' },
  { value: 'r-8830', name: 'release-1.8.0-smoke-and-soak-extended-duration', ranAt: 'Yesterday 6:15 PM', status: 'incomplete' },
  { value: 'r-8829', name: 'hotfix-verification', ranAt: 'Yesterday 2:03 PM', status: 'completed' },
  { value: 'r-8815', name: 'weekly-chaos-injection-broad-sweep', ranAt: 'Jul 2, 4:20 PM', status: 'incomplete' },
  { value: 'r-8802', name: 'main-branch-continuous', ranAt: 'Jul 1, 8:00 AM', status: 'completed' },
].map((r) => ({ ...r, label: r.name }))

export function SelectRenderOptionDemo() {
  useElements()
  const [value, setValue] = useState('r-8842')
  return (
    // Cap the popover so the wide names ellipsize. The trigger width only floors the
    // menu; it grows to fit content until a max-width caps it.
    <div className="run-select" style={{ width: '260px' }}>
      <style>{`.run-select a-menu::part(menu) { max-width: 260px; }`}</style>
      <Select
        label="Test run"
        filter
        options={RUNS}
        value={value}
        onValueChange={setValue}
        renderOption={(o) => {
          const run = o as Run
          return (
            <div style={{ display: 'flex', flexDirection: 'column', flex: '1', minWidth: 0, gap: '2px' }}>
              {/* The ellipsized name is the anchor; the nested Tooltip reveals the full
                  name when it's clipped (`truncatedOnly`). */}
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {run.name}
                <Tooltip truncatedOnly>{run.name}</Tooltip>
              </span>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-3)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                  {run.ranAt}
                </span>
                <Tag size="small" tone={RUN_TONE[run.status]} style={{ marginInlineStart: 'auto' }}>
                  {RUN_LABEL[run.status]}
                </Tag>
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}

// Width & truncation: the menu grows to fit its widest row until the content
// ellipsizes and the menu is capped. Two dropdowns show the difference; the capped
// rows reveal the full path via a truncation Tooltip.
const PATHS: SelectOption[] = [
  { value: 'revenue', label: 'src/features/dashboard/RevenueChart.tsx' },
  { value: 'billing', label: 'src/features/account/settings/BillingPanel.tsx' },
  { value: 'session', label: 'src/lib/auth/session/useCurrentUser.ts' },
  { value: 'date', label: 'src/utils/date.ts' },
]

// Same ellipsis-ready row for both dropdowns: a shrinkable box + single-line
// ellipsis, with a Tooltip that reveals the full path when it's clipped. It
// truncates once the menu is capped; otherwise the menu grows to fit it.
const renderPath = (o: SelectOption) => (
  <span style={{ display: 'block', flex: '1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {o.label}
    <Tooltip truncatedOnly>{o.label}</Tooltip>
  </span>
)

export function SelectTruncateDemo() {
  useElements()
  const [a, setA] = useState('billing')
  const [b, setB] = useState('billing')
  return (
    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* The cap is the only difference between the two: it's what makes the wide
          rows truncate instead of stretching the menu. */}
      <style>{`.path-capped a-menu::part(menu) { max-width: 220px; }`}</style>
      <div style={{ width: '220px' }}>
        <Select label="No cap · grows to fit" options={PATHS} value={a} onValueChange={setA} renderOption={renderPath} />
      </div>
      <div className="path-capped" style={{ width: '220px' }}>
        <Select label="Capped · ellipsizes" options={PATHS} value={b} onValueChange={setB} renderOption={renderPath} />
      </div>
    </div>
  )
}

// renderIndicator: a leading status dot colored by log level, filled when selected.
type Level = SelectOption & { dot: string }
const LEVELS: Level[] = [
  { value: 'error', label: 'error', hint: 'Failures and exceptions', dot: 'var(--text-2-critical)' },
  { value: 'warning', label: 'warning', hint: 'Recoverable issues', dot: 'var(--text-2-warning)' },
  { value: 'info', label: 'info', hint: 'Normal operational events', dot: 'var(--text-2-info)' },
  { value: 'debug', label: 'debug', hint: 'Verbose diagnostic detail', dot: 'var(--text-3)' },
]

export function SelectRenderIndicatorDemo() {
  useElements()
  const [value, setValue] = useState('info')
  return (
    <div style={{ width: '220px' }}>
      <Select
        label="Log level"
        indicator="check"
        options={LEVELS}
        value={value}
        onValueChange={setValue}
        renderIndicator={(state) => {
          const dot = (LEVELS.find((l) => l.value === state.value) as Level).dot
          return (
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                display: 'inline-block',
                boxShadow: `inset 0 0 0 2px ${dot}`,
                background: state.selected ? dot : 'transparent',
              }}
            />
          )
        }}
      />
    </div>
  )
}

export function SelectTriggerDemo() {
  useElements()
  const [value, setValue] = useState<string[]>(['stream', 'message'])
  return (
    <Select
      selection="multiple"
      options={FILTER_OPTS}
      value={value}
      onValueChange={setValue}
      renderTrigger={({ open, selected }) => (
        // A single focusable element the menu anchors to. It carries its own ARIA;
        // `state.open` drives aria-expanded, `selected` drives the count Tag.
        <Button icon="filter" label="Filter" priority="secondary" aria-haspopup="menu" aria-expanded={open ? 'true' : 'false'}>
          {selected.length > 0 && (
            <Tag size="small" priority="primary" tone="brand">
              {selected.length === FILTER_OPTS.length ? 'All' : selected.length}
            </Tag>
          )}
        </Button>
      )}
    />
  )
}

// Arbitrary table columns. Selection means *hidden*, so `value` is the list of
// hidden columns and starts empty (every column visible).
const COLUMNS = ['Name', 'Status', 'Owner', 'Created', 'Duration', 'Environment', 'Branch', 'Commit']

export function SelectColumnsDemo() {
  useElements()
  const [hidden, setHidden] = useState<string[]>([])
  return (
    <Select
      selection="multiple"
      options={COLUMNS}
      value={hidden}
      onValueChange={setHidden}
      // Selecting a column hides it: eye by default, eye-closed once hidden.
      renderIndicator={({ selected }) => (
        <Icon shape={selected ? 'eye-closed' : 'eye'} />
      )}
      renderTrigger={({ open, selected }) => (
        <Button icon="columns-3-cog" priority="tertiary" aria-label="Configure columns"
          aria-haspopup="menu" aria-expanded={open ? 'true' : 'false'}>
          {selected.length > 0 && (
            <Tag size="small" priority="secondary" tone="neutral">{selected.length}</Tag>
          )}
        </Button>
      )}
    />
  )
}

const TAGS = ['bug', 'feature', 'chore', 'docs']

export function SelectEmptyDemo() {
  useElements()
  const [options, setOptions] = useState<string[]>(TAGS)
  const [value, setValue] = useState<string>()
  const [loading, setLoading] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '260px' }}>
      <Checkbox size="small" checked={loading} onStateChange={(_e, { next }) => setLoading(next === true)}>
        Simulate loading
      </Checkbox>
      <Select
        label="Tag"
        filter
        placeholder="Filter or create…"
        options={loading ? [] : options}
        value={value}
        onValueChange={setValue}
        // `query` is the current filter text; loading is the consumer's own state.
        renderEmpty={({ query }) =>
          loading ? (
            <MenuSeparator>Loading…</MenuSeparator>
          ) : (
            <>
              <MenuSeparator>No options are matching the filter</MenuSeparator>
              <MenuItem
                icon="plus"
                label={`Create "${query}"`}
                onSelect={() => {
                  setOptions((o) => [...o, query])
                  setValue(query)
                }}
              />
            </>
          )
        }
      />
    </div>
  )
}

export function SelectGhostDemo() {
  useElements()
  const [value, setValue] = useState('stream')
  return (
    <div className="ghost-select" style={{ width: '220px' }}>
      <Select
        options={['output_text', 'stream', 'container', 'vtime', 'custom']}
        value={value}
        onValueChange={setValue}
      />
    </div>
  )
}

export function SelectControlledDemo() {
  useElements()
  const [value, setValue] = useState('stream')
  return (
    <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Select
        label="Field"
        placeholder="Select a field…"
        options={['output_text', 'stream', 'container', 'vtime', 'custom']}
        value={value}
        onValueChange={setValue}
      />
      <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>
        Selected value: <code>{value || '—'}</code>
      </span>
    </div>
  )
}
