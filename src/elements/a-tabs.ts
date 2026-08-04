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
//   • Scroll — the selected tab is revealed within the strip's OWN scrollport (never the
//     document): it moves this element's scroll offset, not the DOM. See #revealTab.
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
  static observedAttributes = ["state", "disabled", "orientation", "noslide"];

  private internals?: ElementInternals;
  private uncontrolledValue: string | null = null;
  private seeded = false;
  private observer?: MutationObserver;
  private resizeObserver?: ResizeObserver;
  private resizeTimer?: number;
  private resizeFrame?: number;
  // The tab last scrolled into view — so scroll-into-view fires only when the SELECTION
  // changes, not on every sync() (orientation / disabled changes call sync() too).
  private lastSelected: ATabElement | null = null;
  // True after the first connect — gates the native `change` event so it never fires
  // for the initial seed, and gates scroll-into-view so mounting doesn't jump the page.
  private alive = false;
  // Gates sync() until the child <a-tab>s are upgraded (set a microtask after
  // connect). Adopted HTML (a ClientRouter swap, innerHTML) upgrades the parent
  // first, so an eager sync() reads `t.value` as undefined and writes
  // `t.selected` as own properties that shadow the accessors after upgrade.
  // Microtasks run after the adopting task's upgrades, so deferring is enough.
  private childrenReady = false;

  /** The selected tab's value, or `null` when nothing is selected. */
  get value(): string | null {
    return this.#currentValue;
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
    this.#syncResizeObserver();

    // First sync deferred to a microtask (see childrenReady). `alive` flips
    // after it, so the initial apply never scrolls or fires `change`.
    queueMicrotask(() => {
      if (!this.isConnected) return;
      this.childrenReady = true;
      this.sync();
      this.alive = true;
    });
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    this.#clearResizeTransitionPause();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (name === "noslide" && this.isConnected) this.#syncResizeObserver();
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
  get #currentValue() {
    return this.hasAttribute("state")
      ? this.getAttribute("state")
      : this.uncontrolledValue;
  }

  get #isDisabled() {
    return (
      this.hasAttribute("disabled") ||
      (this.internals?.states.has("disabled") ?? false)
    );
  }

  get #isVertical() {
    return this.getAttribute("orientation") === "vertical";
  }

  get #tabs() {
    return Array.from(this.querySelectorAll("a-tab")) as ATabElement[];
  }

  #syncResizeObserver() {
    const canSlide =
      !this.hasAttribute("noslide") &&
      typeof this.view.ResizeObserver === "function" &&
      this.view.CSS.supports("anchor-scope: all");
    if (!canSlide) {
      this.resizeObserver?.disconnect();
      this.#clearResizeTransitionPause();
      return;
    }
    this.resizeObserver ??= new this.view.ResizeObserver(this.#pauseIndicatorTransition);
    this.resizeObserver.observe(this);
  }

  // The anchored indicator's far edge changes when its strip resizes. Pause its
  // edge transition through a resize burst so it cannot stretch between layouts.
  #pauseIndicatorTransition = () => {
    this.internals?.states.add("resizing");
    if (this.resizeTimer != null) this.view.clearTimeout(this.resizeTimer);
    if (this.resizeFrame != null) this.view.cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = undefined;
    this.resizeTimer = this.view.setTimeout(() => {
      this.resizeTimer = undefined;
      this.resizeFrame = this.view.requestAnimationFrame(() => {
        this.resizeFrame = undefined;
        this.internals?.states.delete("resizing");
      });
    }, 120);
  };

  #clearResizeTransitionPause() {
    if (this.resizeTimer != null) this.view.clearTimeout(this.resizeTimer);
    if (this.resizeFrame != null) this.view.cancelAnimationFrame(this.resizeFrame);
    this.resizeTimer = undefined;
    this.resizeFrame = undefined;
    this.internals?.states.delete("resizing");
  }

  private sync = () => {
    if (!this.childrenReady) return; // deferred first sync covers this
    const value = this.#currentValue;
    const tabs = this.#tabs;
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

    // Keep the selected tab visible WITHIN the strip — but only when the SELECTION
    // actually changed, so an orientation / disabled toggle (which also runs sync())
    // never yanks anything. Guarded by `alive` so the initial seed never scrolls.
    if (this.alive && selectedEl && selectedEl !== this.lastSelected) {
      this.#revealTab(selectedEl);
    }
    this.lastSelected = selectedEl;
  };

  // Reveal a tab inside the strip's OWN scrollport — never the document. `scrollIntoView()`
  // walks up and scrolls every scroll ancestor, so inside a `position: sticky` header with
  // `scroll-behavior: smooth` it glides the whole page a few px on every switch. Scrolling
  // only this element's scrollLeft/scrollTop keeps the correction where it belongs: a no-op
  // when the strip fits (the default horizontal strip is `overflow: hidden` and ellipsizes),
  // a real move for a vertical (`overflow-y: auto`) or opt-in scrollable strip. Reads layout,
  // writes only this element's scroll offset (declarative-DOM safe: scroll, not a DOM mutation).
  #revealTab(tab: ATabElement) {
    const s = this.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    if (this.#isVertical) {
      if (t.top < s.top) this.scrollTop -= s.top - t.top;
      else if (t.bottom > s.bottom) this.scrollTop += t.bottom - s.bottom;
    } else {
      if (t.left < s.left) this.scrollLeft -= s.left - t.left;
      else if (t.right > s.right) this.scrollLeft += t.right - s.right;
    }
  }

  // The shared state algorithm: fire the cancelable `statechange` *before* applying.
  // Controlled never self-applies; uncontrolled applies unless vetoed.
  private requestSelect(next: string) {
    const prev = this.#currentValue;
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
   *  (`null` when nothing is selected). Returns false if a listener vetoed.
   *  Neither bubbles nor composed — a point-to-point request to this element's
   *  own wrapper, not a notification (see STATEFUL-COMPONENTS.md). */
  private emitStateChange(next: string | null, prev: string | null): boolean {
    return this.dispatchEvent(
      new CustomEvent("statechange", {
        cancelable: true,
        detail: { next, prev },
      }),
    );
  }

  private onClick = (e: MouseEvent) => {
    if (this.#isDisabled) return;
    const tab = (e.target as HTMLElement | null)?.closest("a-tab") as ATabElement | null;
    if (!tab || tab.hasAttribute("disabled")) return;
    // Move real focus to the clicked tab. A no-op in raw/aria-activedescendant mode
    // (the tab has no tabindex); a real move in the wrapper's focusable-tabs mode.
    // preventScroll so focus never nudges the page — the strip reveals the tab itself
    // (#revealTab). Without it, focus scrolls the document a px or two, which a sticky
    // header + scroll-behavior:smooth turns into a visible glide on every switch.
    tab.focus({ preventScroll: true });
    this.requestSelect(tab.value);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.#isDisabled) return;
    const enabled = this.#tabs.filter((t) => !t.hasAttribute("disabled"));
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
      target.focus({ preventScroll: true });
      this.requestSelect(target.value);
      return;
    }

    // Arrow keys step along the orientation axis only (vertical → Up/Down,
    // horizontal → Left/Right), matching the WAI-ARIA tabs pattern.
    const forward = e.key === (this.#isVertical ? "ArrowDown" : "ArrowRight");
    const back = e.key === (this.#isVertical ? "ArrowUp" : "ArrowLeft");
    if (!forward && !back) return;
    e.preventDefault();

    let i = focused ? enabled.indexOf(focused) : -1;
    if (i === -1) i = enabled.findIndex((t) => t.value === this.#currentValue);
    if (i === -1) i = 0;

    const next = enabled[(i + (forward ? 1 : -1) + enabled.length) % enabled.length];
    // Selection follows focus (automatic activation): move focus, then request the
    // pick. `.focus()` moves real focus when tabs are focusable; in raw mode it no-ops and the
    // sync()'d aria-activedescendant is what advances for AT. preventScroll for the same
    // reason as the click path — the strip self-reveals the tab via #revealTab.
    next.focus({ preventScroll: true });
    this.requestSelect(next.value);
  };
}

export function register_a_tabs() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-tabs"))
    customElements.define("a-tabs", ATabsElement);
}
register_a_tabs();
