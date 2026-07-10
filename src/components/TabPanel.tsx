/**
 * A tab panel inside `<Tabs>`. Renders a self-managing `<a-tabpanel>` — the element
 * finds its `<a-tabs>` (its sibling in the `Tabs` container), matches by `value`,
 * and shows/hides itself off-DOM. This wrapper is a pure projection: it sets the
 * static ARIA (`role`, `tabindex`, `value`) and passes `children` straight through;
 * `Tabs` never reads or toggles it.
 *
 * Use it as a direct child of `<Tabs>`, paired to an `options` entry by `value`.
 * For a strip and panels in different layout regions, or to unmount an inactive
 * panel (the old `mounting="active" | "lazy"`), drive selection with a controlled
 * `value` and render the content yourself — see the Tabs docs.
 */
export interface TabPanelProps {
  /** Pairs this panel with the tab (`options` entry) of the same `value`. */
  value: string
  /** Panel content — arbitrary React/Preact. */
  children?: React.ReactNode
  /** How this panel hides while inactive: `display` (default — removed from layout
   *  and the a11y tree) or `visibility` (keeps its layout box, to measure it or
   *  avoid reflow). Both stay mounted; to *not render* an inactive panel, render it
   *  conditionally off a controlled `value` (see the Tabs docs).
   *  @defaultValue display */
  hideMode?: "display" | "visibility"
  /** CSS class on the rendered `<a-tabpanel>`. */
  className?: string
  /** Inline style on the rendered `<a-tabpanel>`. */
  style?: React.CSSProperties
}

export const TabPanel = ({ value, children, hideMode, className, style }: TabPanelProps) => (
  <a-tabpanel
    value={value}
    role="tabpanel"
    tabIndex={0}
    // 'display' is the implicit default — only the visibility variant needs the attr.
    hide-mode={hideMode === "visibility" ? "visibility" : undefined}
    class={className}
    style={style}
  >
    {children}
  </a-tabpanel>
)
