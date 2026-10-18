import { useEffect, useState } from 'preact/hooks'
import { Button, InputAutocomplete, type SelectOption } from '@antadesign/anta'
import styles from './InputAutocompleteDemos.module.css'

const useElements = () =>
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

const FRAMEWORKS = [
  'React', 'Preact', 'Solid', 'Svelte', 'Vue', 'Angular', 'Qwik', 'Lit', 'Astro',
]

export function InputAutocompleteBasicDemo() {
  useElements()
  const [value, setValue] = useState('')
  return (
    <div className={styles.stack}>
      <InputAutocomplete
        label="Framework"
        placeholder="Type to search…"
        clearable
        suggestions={FRAMEWORKS}
        value={value}
        onValueChange={setValue}
      />
      <div className={styles.value}>Value: <code>{value || '(empty)'}</code></div>
    </div>
  )
}

const PACKAGES: SelectOption[] = [
  { value: '@antadesign/anta', label: 'Anta', hint: 'UI components', icon: 'cube' },
  { value: '@antadesign/plot', label: 'Plot', hint: 'Canvas charts', icon: 'workflow' },
  { value: '@antadesign/stickers', label: 'Stickers', hint: 'Illustrations', icon: 'asterisk' },
  { value: '@antadesign/archived', label: 'Archived', hint: 'Unavailable', disabled: true },
]

export function InputAutocompleteSuggestionsDemo() {
  useElements()
  return <InputAutocomplete label="Package" hint="Choose a package name or enter another." suggestions={PACKAGES} />
}

export function InputAutocompleteControlledDemo() {
  useElements()
  const [value, setValue] = useState('React')
  return (
    <div className={styles.stack}>
      <InputAutocomplete label="Framework" suggestions={FRAMEWORKS} value={value} onValueChange={setValue} clearable />
      <Button label="Reset text" onClick={() => setValue('')} />
    </div>
  )
}

const PROJECTS = ['Billing service', 'Billing dashboard', 'Build tools', 'Customer portal']

export function InputAutocompletePrefixDemo() {
  useElements()
  return (
    <InputAutocomplete
      label="Framework prefix"
      suggestions={FRAMEWORKS}
      filter={(option, query) => option.value.toLowerCase().startsWith(query.trim().toLowerCase())}
    />
  )
}

export function InputAutocompleteResultsDemo() {
  useElements()
  const [value, setValue] = useState('')
  const results = PROJECTS.filter(name => name.toLowerCase().includes(value.toLowerCase())).slice().reverse()
  return (
    <InputAutocomplete
      label="Project"
      hint="Results use the application's order. You can also enter a new project."
      suggestions={results}
      filter={false}
      value={value}
      onValueChange={setValue}
    />
  )
}

export function InputAutocompleteStylingDemo() {
  useElements()
  return <InputAutocomplete className="package-field" label="Package" suggestions={PACKAGES} tone="info" />
}
