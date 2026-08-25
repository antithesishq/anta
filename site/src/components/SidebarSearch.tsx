import { Input } from '@antadesign/anta'
import { useEffect, useState } from 'preact/hooks'

/**
 * Input trigger for the documentation search dialog. The layout owns the
 * URL-driven value and delegated interactions; this component only keeps
 * Anta's Input composition together, including its in-field clear action.
 */
export default function SidebarSearch() {
  const [hasValue, setHasValue] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const input = document.querySelector<HTMLElement & { value?: string }>('[data-sidebar-search-input]')
    const syncValue = (event?: Event) => {
      const value = event instanceof CustomEvent
        ? event.detail as string
        : input?.value ?? ''
      setHasValue(Boolean(value))
    }

    syncValue()
    document.addEventListener('anta-sidebar-search-value', syncValue)
    return () => document.removeEventListener('anta-sidebar-search-value', syncValue)
  }, [])

  return (
    <Input
      type="search"
      size="small"
      dimActions
      placeholder="Search"
      aria-label="Search documentation"
      aria-haspopup="dialog"
      data-search-trigger
      data-sidebar-search-input
      onInput={(event) => setHasValue(Boolean((event.target as { value?: string }).value))}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      trailing={hasValue || focused ? undefined : <span data-sidebar-search-shortcut>Ctrl+K or /</span>}
    />
  )
}
