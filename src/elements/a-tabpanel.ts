import { HTMLElementBase } from "../anta_helpers";
import "./a-tabpanel.css";

// ─────────────────────────────────────────────────────────────────────────────
// <a-tabpanel> — the body paired to a tab. A SELF-MANAGING element (no shadow; its
// children stay light DOM, like <a-tab> / <a-menu-item>). It finds its <a-tabs>,
// reads the active value, and shows/hides ITSELF entirely off-DOM:
//   • `:state(active)` (ElementInternals) drives visibility — a-tabpanel.css hides
//     an inactive panel (`display:none`, or `visibility:hidden` under
//     `hide-mode="visibility"`).
//   • `internals.ariaLabelledByElements` points the panel at its tab — off-DOM ARIA
//     element-reflection, the same latitude <a-tabs> uses for
//     `ariaActiveDescendantElement`.
//
// It never writes a light-DOM attribute (on itself or anything else): a web
// component mutating light DOM would desync the worker-thread reactive model that
// owns the light tree. The `Tabs` wrapper only renders it — `role` / `value` /
// `hide-mode` are static, JSX-set — and never toggles it.
//
// Coordination is by DOM scope: the panel and its <a-tabs> are flat siblings under
// one parent (`this.parentElement`) — `Tabs` renders them with no wrapper element —
// matched by `value`, and re-syncs on the tablist's `change` (which fires for both
// controlled and uncontrolled transitions). For split layouts (strip and panels in
// different regions, so no shared parent) there's no scope — drive selection with a
// controlled `value` and render the content yourself. Not SSR-visible: the active
// panel resolves on upgrade (a non-hydrated static render shows no panel until the
// element registers).
// ─────────────────────────────────────────────────────────────────────────────
export class ATabPanelElement extends HTMLElementBase {
  static observedAttributes = ["value"];

  private internals?: ElementInternals;
  // The tablist this panel belongs to (its flat sibling under the same parent).
  private tabs: (Element & { value?: string | null }) | null = null;
  private onTabsChange = () => this.sync();

  constructor() {
    super();
    // `attachInternals` carries the off-DOM `:state(active)` + ARIA reflection.
    // Guarded for non-standard runtimes (worker DOM / partial polyfill).
    try {
      this.internals = this.attachInternals?.();
    } catch {}
  }

  connectedCallback() {
    this.bindTabs();
    this.sync();
    // The tablist may upgrade AFTER this panel (custom-element upgrade isn't
    // guaranteed in tree order across renderers) — re-bind + re-sync next frame so
    // the active panel resolves even then.
    requestAnimationFrame(() => {
      if (!this.tabs) this.bindTabs();
      this.sync();
    });
  }

  disconnectedCallback() {
    this.tabs?.removeEventListener("change", this.onTabsChange);
    this.tabs = null;
  }

  attributeChangedCallback() {
    this.sync();
  }

  /** Locate the sibling <a-tabs> (the strip and panels are flat siblings under one
   *  parent — `Tabs` renders no wrapper) and subscribe to its `change`. */
  private bindTabs() {
    const tabs =
      (this.parentElement?.querySelector(":scope > a-tabs") as
        | (Element & { value?: string | null })
        | null) ?? null;
    if (tabs === this.tabs) return;
    this.tabs?.removeEventListener("change", this.onTabsChange);
    this.tabs = tabs;
    this.tabs?.addEventListener("change", this.onTabsChange);
  }

  private sync() {
    const value = this.getAttribute("value");
    const active = !!this.tabs && value === (this.tabs.value ?? null);
    try {
      if (active) this.internals?.states?.add("active");
      else this.internals?.states?.delete("active");
    } catch {}
    // Off-DOM aria-labelledby → the tab of the same value (feature-guarded;
    // element-reference ARIA reflection is Baseline-2025).
    if (this.internals && "ariaLabelledByElements" in this.internals) {
      const tab =
        value != null
          ? (this.tabs?.querySelector(`a-tab[value="${cssEscape(value)}"]`) as HTMLElement | null)
          : null;
      (this.internals as unknown as { ariaLabelledByElements: Element[] | null }).ariaLabelledByElements =
        tab ? [tab] : [];
    }
  }
}

function cssEscape(v: string): string {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(v) : v;
}

export function register_a_tabpanel() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-tabpanel"))
    customElements.define("a-tabpanel", ATabPanelElement);
}
register_a_tabpanel();
