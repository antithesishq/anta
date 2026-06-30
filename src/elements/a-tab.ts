import { HTMLElementBase } from "../anta_helpers";
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
// Focus/`tabindex`, `role`, and `aria-controls` are NOT this element's concern: the
// `Tabs` wrapper renders each tab's `tabindex` + the ARIA wiring declaratively. In
// raw hand-assembly the author supplies them. See a-tabs.ts.
// ─────────────────────────────────────────────────────────────────────────────
export class ATabElement extends HTMLElementBase {
  static observedAttributes = ["selected"];
  private internals?: ElementInternals;

  constructor() {
    super();
    this.internals = this.attachInternals?.();
  }

  connectedCallback() {
    // Seed ONLY a hand-authored `selected` attribute as the initial paint — never
    // clobber a selection the parent <a-tabs> may have already set as a *property*.
    // The tablist coordinates off-DOM via the `selected` property (not the attribute),
    // and connectedCallback fires parent-first: when elements are pre-registered (e.g.
    // a hydrated island), <a-tabs>.sync() selects the active tab before this callback
    // runs, so calling applyState(false) for an absent attribute here would wipe it.
    if (this.hasAttribute("selected")) this.applyState(true);
  }

  attributeChangedCallback(name: string) {
    if (name === "selected") this.applyState(this.hasAttribute("selected"));
  }

  get selected(): boolean {
    // Selection lives in ElementInternals (set via the `selected` property by the
    // tablist). The `selected` attribute only SEEDS initial state on connect — the
    // element never writes it back (no host mutation), so it can't reflect later
    // changes; reading it here would go stale, so don't.
    return this.internals?.states.has("selected") ?? false;
  }
  set selected(on: boolean) {
    this.applyState(!!on);
  }

  get value(): string {
    return this.getAttribute("value") ?? "";
  }

  // `selected` is the single source: it drives the visual `:state(selected)` and
  // publishes `aria-selected` through ElementInternals (the accessibility tree,
  // not a DOM attribute). <a-tabs> only sets `t.selected`; the tab owns how it
  // reflects that. role="tab" comes from the wrapper, which gives ariaSelected
  // something to attach to.
  private applyState(on: boolean) {
    if (!this.internals) return;
    if (on) this.internals.states.add("selected");
    else this.internals.states.delete("selected");
    this.internals.ariaSelected = on ? "true" : "false";
  }
}

export function register_a_tab() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-tab"))
    customElements.define("a-tab", ATabElement);
}
register_a_tab();
