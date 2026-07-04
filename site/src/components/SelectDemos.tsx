import { useEffect, useState } from 'preact/hooks'
import { Select } from '@antadesign/anta'
import type { SelectOption } from '@antadesign/anta'

/**
 * Hydrated island demos for the Select docs. Select is a *composed wrapper*
 * (no coordinating element), so its interactivity lives in Preact — a static
 * <Preview> would render the field but couldn't update on selection. These small
 * `client:load` islands hydrate so the previews actually work.
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
