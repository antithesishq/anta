import { HTMLElementBase } from "../anta_helpers";
import { ATabElement } from "./a-tab";
import "./a-tabs.css";

// ─────────────────────────────────────────────────────────────────────────────
// <a-tabs> — the tablist + single-select coordinator (sibling of <a-radio-group>).
// Its <a-tab> children are plain light DOM, laid out by a-tabs.css, so the strip is
// restylable with ordinary CSS and the whole thing is usable hand-assembled.
//
// THE INVARIANT: this element NEVER mutates the DOM. It writes nothing to its own
// host attributes and nothing to its child <a-tab>s. Everything it coordinates is
// expressed off-DOM:
//
//   • Selection — it sets each tab's `selected` *property* (not attribute). The tab
//     reflects that into `:state(selected)` + `aria-selected` via its OWN
//     ElementInternals (see a-tab.ts). No attribute is written to any tab.
//   • Focus — `internals.ariaActiveDescendantElement` points at the selected tab,
//     honored by AT only while the tablist itself holds focus (the raw hand-assembled
//     path, `<a-tabs tabindex="0">`). In the `Tabs` wrapper path every tab carries its
//     own `tabindex="0"` (rendered declaratively by the wrapper) and real focus lands
//     on them, so this reference is simply inert. `.focus()` is a no-op on a tab with
//     no tabindex (raw mode) and a real move on one that has it (wrapper mode) —
//     neither writes the DOM.
//   • Scroll — the selected tab is scrolled into view (`block/inline: nearest`), like
//     `.focus()`: it moves the viewport, not the DOM.
//
// Panels live OUTSIDE this element (they're siblings managed by the `Tabs` wrapper,
// which shows/hides them from the value it mirrors via `statechange`) — <a-tabs> is
// only the strip. Unlike <a-radio-group> it is NOT form-associated: a tablist submits
// nothing.
//
// State follows the shared contract (STATEFUL-COMPONENTS.md): controlled when the
// `state` attribute is present (the wrapper always drives it this way), otherwise
// uncontrolled via an in-memory value seeded from `default-state` (the raw path). A
// pick dispatches a cancelable `statechange` BEFORE applying; controlled callers
// re-assert `state`, uncontrolled callers can veto with `preventDefault()`.
// ─────────────────────────────────────────────────────────────────────────────
export class ATabsElement extends HTMLElementBase {
  static observedAttributes = ["state", "disabled", "orientation"];

  private internals?: ElementInternals;
  private uncontrolledValue: string | null = null;
  private seeded = false;
  private observer?: MutationObserver;
  // The tab last scrolled into view — so scroll-into-view fires only when the SELECTION
  // changes, not on every sync() (orientation / disabled changes call sync() too).
  private lastSelected: ATabElement | null = null;
  // True after the first connect — gates the native `change` event so it never fires
  // for the initial seed, and gates scroll-into-view so mounting doesn't jump the page.
  private alive = false;

  /** The selected tab's value, or `null` when nothing is selected. */
  get value(): string | null {
    return this.currentValue;
  }

  constructor() {
    super();
    this.internals = this.attachInternals?.();
  }

  connectedCallback() {
    // Seed the uncontrolled value only on the FIRST connect: a user's selection must
    // survive DOM moves / re-parents rather than snapping back to `default-state`.
    // The listeners use stable arrow-fn refs, so re-adding on reconnect is a no-op.
    if (!this.seeded) {
      this.uncontrolledValue = this.getAttribute("default-state");
      this.seeded = true;
    }
    this.addEventListener("click", this.onClick);
    this.addEventListener("keydown", this.onKeyDown);

    // Reconcile selection when tabs are added OR removed. The element owns this (a JSX
    // wrapper has no live DOM handle in a worker-rendered tree). Scoped to <a-tab>
    // add/remove and coalesced by MutationObserver into one callback per batch.
    // Realm-correct constructor (`this.view`) for the iframe-hosted playground.
    this.observer ??= new this.view.MutationObserver((records) => {
      const touchedTabs = records.some((rec) =>
        [...rec.addedNodes, ...rec.removedNodes].some(
          (n) =>
            n.nodeName === "A-TAB" ||
            (n as Element).querySelector?.("a-tab") != null,
        ),
      );
      if (touchedTabs) this.sync();
    });
    this.observer.observe(this, { childList: true, subtree: true });

    this.sync();
    this.alive = true;
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    this.sync();
    // Controlled apply: a changed `state` is the consumer's accepted value — fire
    // `change` on the real transition (the post-apply counterpart to statechange).
    if (name === "state" && this.alive && newValue !== oldValue) this.emitChange();
  }

  formDisabledCallback(disabled: boolean) {
    if (disabled) this.internals?.states.add("disabled");
    else this.internals?.states.delete("disabled");
    this.sync();
  }

  // Controlled when `state` is present; otherwise the in-memory uncontrolled value.
  private get currentValue() {
    return this.hasAttribute("state")
      ? this.getAttribute("state")
      : this.uncontrolledValue;
  }

  private get isDisabled() {
    return (
      this.hasAttribute("disabled") ||
      (this.internals?.states.has("disabled") ?? false)
    );
  }

  private get isVertical() {
    return this.getAttribute("orientation") === "vertical";
  }

  private get tabs() {
    return Array.from(this.querySelectorAll("a-tab")) as ATabElement[];
  }

  private sync = () => {
    const value = this.currentValue;
    const tabs = this.tabs;
    // `null` (attribute absent) means "nothing selected"; an empty string is a *real*
    // value (a legitimate `value=""` tab), so only the null check guards.
    const selectedEl = tabs.find((t) => t.value === value && value != null) ?? null;

    // Selection, off-DOM: set the `selected` *property* on each tab; the tab turns
    // that into :state(selected) + aria-selected via its own internals.
    for (const t of tabs) t.selected = t === selectedEl;

    // Roving focus, off-DOM: point aria-activedescendant at the selected tab (see the
    // header note). Feature-guarded — absent it, the wrapper's per-tab `tabindex` is
    // what carries focus.
    if (this.internals && "ariaActiveDescendantElement" in this.internals) {
      this.internals.ariaActiveDescendantElement = selectedEl;
    }

    // Keep the selected tab visible in the scrolling strip — but only when the SELECTION
    // actually changed, so an orientation / disabled toggle (which also runs sync())
    // never yanks the viewport. Guarded by `alive` so the initial seed never scrolls;
    // `nearest` moves the viewport minimally.
    if (this.alive && selectedEl && selectedEl !== this.lastSelected) {
      selectedEl.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    this.lastSelected = selectedEl;
  };

  // The shared state algorithm: fire the cancelable `statechange` *before* applying.
  // Controlled never self-applies; uncontrolled applies unless vetoed.
  private requestSelect(next: string) {
    const prev = this.currentValue;
    if (next === prev) return;
    const ok = this.emitStateChange(next, prev);
    if (this.hasAttribute("state")) return;
    if (ok) {
      this.uncontrolledValue = next;
      this.sync();
      this.emitChange();
    }
  }

  // Native `change`, fired *after* a selection applies (user pick or a controlled
  // `state` update) — the post-apply counterpart to the cancelable `statechange`.
  private emitChange() {
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Dispatch the shared cancelable `statechange`. `next`/`prev` are values
   *  (`null` when nothing is selected). Returns false if a listener vetoed. */
  private emitStateChange(next: string | null, prev: string | null): boolean {
    return this.dispatchEvent(
      new CustomEvent("statechange", {
        cancelable: true,
        bubbles: true,
        composed: true,
        detail: { next, prev },
      }),
    );
  }

  private onClick = (e: MouseEvent) => {
    if (this.isDisabled) return;
    const tab = (e.target as HTMLElement | null)?.closest("a-tab") as ATabElement | null;
    if (!tab || tab.hasAttribute("disabled")) return;
    // Move real focus to the clicked tab. A no-op in raw/aria-activedescendant mode
    // (the tab has no tabindex); a real move in the wrapper's focusable-tabs mode.
    tab.focus();
    this.requestSelect(tab.value);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isDisabled) return;
    const enabled = this.tabs.filter((t) => !t.hasAttribute("disabled"));
    if (enabled.length === 0) return;
    const focused = (e.target as HTMLElement | null)?.closest("a-tab") as ATabElement | null;

    if (e.key === " " || e.key === "Enter") {
      if (focused && enabled.includes(focused)) {
        e.preventDefault();
        this.requestSelect(focused.value);
      }
      return;
    }

    // Home / End jump to the first / last enabled tab.
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const target = e.key === "Home" ? enabled[0] : enabled[enabled.length - 1];
      target.focus();
      this.requestSelect(target.value);
      return;
    }

    // Arrow keys step along the orientation axis only (vertical → Up/Down,
    // horizontal → Left/Right), matching the WAI-ARIA tabs pattern.
    const forward = e.key === (this.isVertical ? "ArrowDown" : "ArrowRight");
    const back = e.key === (this.isVertical ? "ArrowUp" : "ArrowLeft");
    if (!forward && !back) return;
    e.preventDefault();

    let i = focused ? enabled.indexOf(focused) : -1;
    if (i === -1) i = enabled.findIndex((t) => t.value === this.currentValue);
    if (i === -1) i = 0;

    const next = enabled[(i + (forward ? 1 : -1) + enabled.length) % enabled.length];
    // Selection follows focus (automatic activation): move focus, then request the
    // pick. `.focus()` moves real focus when tabs are focusable; in raw mode it no-ops and the
    // sync()'d aria-activedescendant is what advances for AT.
    next.focus();
    this.requestSelect(next.value);
  };
}

export function register_a_tabs() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-tabs"))
    customElements.define("a-tabs", ATabsElement);
}
register_a_tabs();
