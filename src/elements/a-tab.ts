import { SelectableChildElement } from "../anta_helpers";
import "./a-tab.css";

// ─────────────────────────────────────────────────────────────────────────────
// <a-tab> — one tab in a tablist. Presentational, the sibling of <a-radio>: it
// owns no selection logic, no keyboard, no scrolling — the enclosing <a-tabs>
// coordinates all of that.
//
// Its one job is to render its own selected state OFF the DOM: the tablist sets
// the `selected` *property* (never an attribute), and the tab mirrors that into a
// `:state(selected)` custom state (the CSS hook) and `aria-selected` via its OWN
// ElementInternals. So <a-tabs> can drive selection without writing any attribute
// to a tab — which is what keeps the whole control free of DOM mutation.
//
// All of that (the property/attribute contract, the ON-only connect seed that stops
// the tablist's initial selection being clobbered) lives in SelectableChildElement,
// shared with <a-radio>; this class only pins the ARIA property to `aria-selected`
// (role="tab" comes from the wrapper, which gives it something to attach to).
//
// Focus/`tabindex`, `role`, and `aria-controls` are NOT this element's concern: the
// `Tabs` wrapper renders each tab's `tabindex` + the ARIA wiring declaratively. In
// raw hand-assembly the author supplies them. See a-tabs.ts.
// ─────────────────────────────────────────────────────────────────────────────
export class ATabElement extends SelectableChildElement {
  protected ariaProp = "ariaSelected" as const;
}

export function register_a_tab() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-tab"))
    customElements.define("a-tab", ATabElement);
}
register_a_tab();
