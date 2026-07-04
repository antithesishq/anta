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
  { value: 'output_text', label: 'output_text', hint: 'Raw log message or event payload' },
  { value: 'stream', label: 'stream', hint: 'Log level: error · info · internal' },
  { value: 'container', label: 'container', hint: 'Host where the event occurred' },
  { value: 'archived', label: 'archived', disabled: true },
  { value: 'custom', label: 'custom', tone: 'brand' },
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
