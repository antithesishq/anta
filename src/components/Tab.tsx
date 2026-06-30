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
