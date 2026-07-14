import { useEffect, useState } from 'preact/hooks'
import { InputAutocomplete } from '@antadesign/anta'

/**
 * Hydrated island demos for the InputAutocomplete docs. It's a composed wrapper
 * (no coordinating element), so its interactivity lives in Preact — a static
 * <Preview> would render the field but couldn't filter or update on typing. These
 * small `client:load` islands hydrate to make the previews interactive.
 */
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
    <div style={{ display: 'grid', gap: '10px', width: '260px' }}>
      <InputAutocomplete
        label="Framework"
        placeholder="Type to search…"
        clearable
        suggestions={FRAMEWORKS}
        value={value}
        onValueChange={setValue}
      />
      <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>
        value: <code>{value || '—'}</code> — type something not in the list; it stays.
      </div>
    </div>
  )
}
