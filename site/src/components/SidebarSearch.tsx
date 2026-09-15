import { Icon, Input } from '@antadesign/anta'
import { useEffect, useState } from 'preact/hooks'

/**
 * Button-backed, Input-styled trigger for the documentation search dialog.
 * The layout owns the URL-driven value and delegated interactions.
 */
export default function SidebarSearch() {
  const [shortcut, setShortcut] = useState('')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
      || navigator.platform
      || navigator.userAgent
    setShortcut(/Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘+K' : 'Ctrl+K')

  }, [])

  useEffect(() => {
    const onState = (event: Event) => setExpanded(Boolean((event as CustomEvent<{ open: boolean }>).detail?.open))
    document.addEventListener('anta-search-state', onState)
    return () => document.removeEventListener('anta-search-state', onState)
  }, [])

  return (
    <Input
      button
      size="medium"
      tone="var(--anta-seed-brand)"
      dimActions
      clearable
      leading={<Icon shape="search" />}
      placeholder="Search or ask"
      aria-label="Search documentation"
      aria-haspopup="dialog"
      aria-expanded={expanded ? 'true' : 'false'}
      aria-controls="docs-search-dialog"
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
