import { Input } from '@antadesign/anta'
import { useEffect, useState } from 'preact/hooks'

/**
 * Input trigger for the documentation search dialog. The layout owns the
 * URL-driven value and delegated interactions; this component only keeps
 * Anta's Input composition together, including its in-field clear action.
 */
export default function SidebarSearch() {
  const [shortcut, setShortcut] = useState('')

  useEffect(() => {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
      || navigator.platform
      || navigator.userAgent
    setShortcut(/Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘+K' : 'Ctrl+K')

  }, [])

  return (
    <Input
      type="search"
      size="medium"
      tone="var(--anta-seed-brand)"
      dimActions
      placeholder="Search or ask"
      aria-label="Search documentation"
      aria-haspopup="dialog"
      data-search-trigger
      data-sidebar-search-input
      onMouseDown={(event) => {
        // Let the dialog receive focus when the search trigger is clicked.
        if (event.button === 0 && !(event.target as HTMLElement).closest('[data-custom-event="clearrequest"]')) {
          event.preventDefault()
        }
      }}
      trailing={<span data-sidebar-search-shortcut>{shortcut ? `${shortcut} or /` : '/'}</span>}
    />
  )
}
