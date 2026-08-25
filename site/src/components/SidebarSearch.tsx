import { Input } from '@antadesign/anta'

/**
 * Input trigger for the documentation search dialog. The layout owns the
 * URL-driven value and delegated interactions; this component only keeps
 * Anta's Input composition together, including its in-field clear action.
 */
export default function SidebarSearch() {
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
      trailing={<span data-sidebar-search-shortcut>Ctrl+K or /</span>}
    />
  )
}
