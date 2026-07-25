import { navigate } from 'astro:transitions/client'
import { Tabs } from '@antadesign/anta'

interface NavTab {
  /** Destination URL — doubles as the tab's `value`. */
  value: string
  label: string
}

interface Props {
  tabs: NavTab[]
  /** The current page's URL (must match one tab's `value`). */
  active: string
  /** Accessible name for the tablist. */
  label: string
}

/**
 * Anta `<Tabs>` used as page navigation: each tab's `value` is a URL, and
 * picking a tab navigates there via the ClientRouter (client-side swap). The
 * strip is controlled to the current page's URL, so it never flickers to the
 * clicked tab before the swap lands. Used for the changelog (main / dev).
 *
 * Navigation runs on `onStateChange` (the pre-apply pick), not `onValueChange`:
 * in controlled mode we deliberately don't update `value`, so the post-apply
 * `onValueChange` wouldn't fire. Needs `client:load` — the tabs are buttons, so
 * the handler must be hydrated to navigate.
 */
export default function NavTabs({ tabs, active, label }: Props) {
  return (
    <Tabs
      value={active}
      label={label}
      options={tabs}
      onStateChange={(_event, { next }) => {
        if (next && next !== active) navigate(next)
      }}
    />
  )
}
