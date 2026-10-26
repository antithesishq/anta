import { useState } from 'preact/hooks'
import { Input, Icon, Button } from '@antadesign/anta'

function SearchActions() {
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)
  return (
    <>
      <Button priority="tertiary" icon="case-sensitive"
        aria-label="Case sensitive" title="Case sensitive"
        selected={caseSensitive} aria-pressed={caseSensitive}
        onClick={() => setCaseSensitive(value => !value)} />
      <Button priority="tertiary" icon="regex"
        aria-label="Regular expression" title="Regular expression"
        selected={regex} aria-pressed={regex}
        onClick={() => setRegex(value => !value)} />
    </>
  )
}

export default function InputAdornmentsDemo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
      <Input label="Leading icon" placeholder="Search…" leading={<Icon shape="search" />} autoComplete="off" />
      <Input label="Trailing actions" placeholder="Search…" trailing={<SearchActions />} dimActions autoComplete="off" />
      <Input label="Clear action" placeholder="Search…" clearable dimActions defaultValue="design tokens" autoComplete="off" />
      <Input label="All adornments" leading={<Icon shape="search" />} trailing={<SearchActions />} clearable dimActions defaultValue="design tokens" autoComplete="off" />
      <Input label="Text adornments" leading="from" trailing="each" defaultValue="$20" autoComplete="off" />
    </div>
  )
}
