import type { IconShape } from "../elements/a-icon.shapes"

/** One tab in a `<Tabs>` strip. A **config component**: `Tabs` reads these props to
 *  render the underlying `<a-tab>` (`tabindex`, `role`, `aria-controls`, and
 *  selection are all `Tabs`' job), so `<Tab>` renders nothing on its own. */
export interface TabProps {
  /** This tab's identity — pairs it with the `<TabPanel value="…">` of the same
   *  value, and the value reported by `onStateChange` / `onChange`. Unique per strip. */
  value: string
  /** Visible label. Alternatively pass `children`. */
  label?: React.ReactNode
  /** Tab content when you need more than a string — used if `label` is omitted. */
  children?: React.ReactNode
  /** Leading icon shape, rendered before the label. */
  icon?: IconShape
  /** Trailing icon shape, rendered after the label. */
  iconTrailing?: IconShape
  /** Fully-round just this tab's box. `<Tabs round>` rounds the whole strip
   *  (tabs + sliding indicator) instead. */
  round?: boolean
  /** Per-tab tone override, same vocabulary as `<Tabs tone>` — colours this one tab's
   *  label + icons (all priorities/modes, named or custom colour) and, when it's the
   *  active tab, its indicator. For a **custom literal colour** the sliding indicator can't
   *  adopt it (the shared moving element can't read a descendant's colour), so a custom tone
   *  colours the label everywhere and the indicator only in `noslide`; the six **named**
   *  tones colour both in every mode. Overrides the strip's `tone` for this tab.
   *  @defaultValue inherits the strip's `tone` */
  tone?: "neutral" | "brand" | "info" | "success" | "warning" | "critical" | (string & {})
  /** Disable just this tab — skipped by keyboard nav and dropped from the tab order
   *  (a disabled-but-selected tab stays reachable, per the ARIA pattern). */
  disabled?: boolean
}

/**
 * A tab inside `<Tabs>`. Configuration only — `Tabs` reads its props and renders the
 * real `<a-tab>`, so this component itself produces no DOM. Use it as a direct child
 * of `<Tabs>`; rendering it elsewhere does nothing.
 */
export const Tab = (_props: TabProps): null => null
