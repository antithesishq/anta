import type { TabsMounting } from "./Tabs"

/** A panel paired to the `<Tab>` of the same `value`. A **config component**: `Tabs`
 *  reads these props and renders the underlying `<a-tabpanel>` (id wiring, show/hide,
 *  `inert`, and the mounting strategy are all `Tabs`' job). */
export interface TabPanelProps {
  /** Pairs this panel with the `<Tab value="…">` of the same value. */
  value: string
  /** Panel content — arbitrary React/Preact. */
  children?: React.ReactNode
  /** Override the `<Tabs mounting>` strategy for just this panel. See `TabsMounting`. */
  mounting?: TabsMounting
  /** CSS class on the rendered `<a-tabpanel>`. */
  className?: string
  /** Inline style on the rendered `<a-tabpanel>`. */
  style?: React.CSSProperties
}

/**
 * A tab panel inside `<Tabs>`. Configuration only — `Tabs` reads its props and renders
 * the real `<a-tabpanel>`, so this component itself produces no DOM. Use it as a direct
 * child of `<Tabs>`; rendering it elsewhere does nothing.
 */
export const TabPanel = (_props: TabPanelProps): null => null
