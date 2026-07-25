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
  /** Land at the section the reader is in: append the id of the heading
   *  they've scrolled to as a `#hash` on the destination URL. Only for tab
   *  sets whose pages share heading slugs (the Colors tone pages). */
  preserveScroll?: boolean
}

/**
 * The heading the reader is "at": the last `main` h1–h3 in DOM order whose top
 * sits at or above 40 % of the viewport. That captures both "scrolled past"
 * headings and headings currently visible in the upper portion of the screen —
 * what the user would expect when they've moved beyond the previous section
 * even if the new heading isn't pinned to the very top. Rect-based, so it
 * works regardless of which element actually scrolls.
 */
function currentSectionId(): string | null {
  const fold = Math.max(80, window.innerHeight * 0.4)
  const headings = document.querySelectorAll<HTMLElement>('main :is(h1, h2, h3)[id]')
  let last: string | null = null
  for (const h of headings) {
    if (h.getBoundingClientRect().top <= fold) last = h.id
  }
  return last
}

/**
 * Anta `<Tabs>` used as page navigation: each tab's `value` is a URL, and
 * picking a tab navigates there via the ClientRouter (client-side swap). The
 * strip is controlled to the current page's URL, so it never flickers to the
 * clicked tab before the swap lands. Used for the changelog (main / dev) and
 * the Colors tone sub-pages (with `preserveScroll`, so the router's scroll-to-
 * fragment lands the reader at the same section on the destination page).
 *
 * Navigation runs on `onStateChange` (the pre-apply pick), not `onValueChange`:
 * in controlled mode we deliberately don't update `value`, so the post-apply
 * `onValueChange` wouldn't fire. Needs `client:load` — the tabs are buttons, so
 * the handler must be hydrated to navigate.
 */
export default function NavTabs({ tabs, active, label, preserveScroll }: Props) {
  return (
    <Tabs
      value={active}
      label={label}
      options={tabs}
      onStateChange={(_event, { next }) => {
        if (!next || next === active) return
        const id = preserveScroll ? currentSectionId() : null
        navigate(id ? `${next}#${id}` : next)
      }}
    />
  )
}
