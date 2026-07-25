import { HTMLElementBase } from "../anta_helpers";
import { ARadioElement } from "./a-radio";
import "./a-radio-group.css";

// ─────────────────────────────────────────────────────────────────────────────
// <a-radio-group> — the single-select coordinator.
//
// All light DOM (no shadow): an optional <a-radio-label>, an <a-radio-list> of
// <a-radio> options, and an optional <a-radio-hint> are plain children laid out
// by a-radio-group.css, so the arrangement is restylable with ordinary CSS.
//
// THE INVARIANT: this element NEVER mutates the DOM. It writes nothing to its own
// host attributes and nothing to its child <a-radio>s. Everything it coordinates
// is expressed off-DOM:
//
//   • Selection — it sets each radio's `selected` *property* (not attribute). The
//     radio reflects that into `:state(selected)` + `aria-checked` via its OWN
//     ElementInternals (see a-radio.ts). No attribute is written to any radio.
//   • Form value — `internals.setFormValue()` on the group (it's the
//     form-associated element).
//   • Roving focus — `internals.ariaActiveDescendantElement` on the group points
//     at the selected radio. This is honored by assistive tech ONLY while the
//     group itself holds focus, which happens in raw hand-assembly where the
//     author makes the group the single tab stop (`<a-radio-group tabindex="0">`).
//     In the `RadioGroup` JSX wrapper path the radios carry a roving `tabindex`
//     (rendered declaratively by the wrapper) and real focus lands on them, so the
//     group is never focused and this reference is simply inert. The two focus
//     models are mutually exclusive by where `tabindex` lives, so the element can
//     maintain the reference unconditionally and let `.focus()` move real focus —
//     `.focus()` is a no-op on a radio that has no `tabindex` (raw mode) and a
//     real move on one that does (wrapper mode). Neither path writes the DOM.
//
// Why no DOM writes: app DOM may be rendered from a worker, so a web component
// that mutates the document fights the renderer. The wrapper is allowed to manage
// the DOM (it renders `tabindex`/`role` declaratively); the element is not.
//
// State follows the shared contract (STATEFUL-COMPONENTS.md): controlled when the
// `state` attribute is present (the wrapper always drives it this way), otherwise
// uncontrolled via an in-memory value seeded from `default-state` (the raw path).
// A pick dispatches a cancelable `statechange` BEFORE applying; controlled callers
// re-assert `state`, uncontrolled callers can veto with `preventDefault()`.
// ─────────────────────────────────────────────────────────────────────────────
export class ARadioGroupElement extends HTMLElementBase {
  static formAssociated = true;
  static observedAttributes = ["state", "disabled"];

  private internals?: ElementInternals;
  private uncontrolledValue: string | null = null;
  private seeded = false;
  private observer?: MutationObserver;
  // True after the first connect — gates the native `change` event so it never
  // fires for the initial seed (only for real, post-connect selection changes).
  private alive = false;
  // True once the child <a-radio>s are guaranteed upgraded — set a microtask
  // after connect. Gates sync(); see a-tabs' `childrenReady` for the full story
  // (inert-parsed subtrees adopted by e.g. Astro's ClientRouter body swap
  // upgrade parent-first, and a sync() against un-upgraded children reads
  // `r.value` as undefined and clobbers their `selected` accessors with own
  // data properties).
  private childrenReady = false;

  /** The selected option's value, or `null` when nothing is selected. */
  get value(): string | null {
    return this.#currentValue;
  }

  constructor() {
    super();
    this.internals = this.attachInternals?.();
  }

  connectedCallback() {
    // Seed the uncontrolled value only on the FIRST connect (see a-checkbox): a
    // user's selection must survive DOM moves / re-parents rather than snapping
    // back to `default-state`. `formResetCallback` re-seeds on purpose. The
    // listeners use stable arrow-fn refs, so re-adding on reconnect is a no-op.
    if (!this.seeded) {
      this.uncontrolledValue = this.getAttribute("default-state");
      this.seeded = true;
    }
    this.addEventListener("click", this.onClick);
    this.addEventListener("keydown", this.onKeyDown);

    // Reconcile selection + the submitted form value when options are added OR
    // removed. The element owns this (a JSX wrapper has no live DOM handle in a
    // worker-rendered tree). Scoped to <a-radio> add/remove (ignores label-text
    // churn) and coalesced by MutationObserver into one callback per batch — so
    // mounting N options is a single O(N) sync, not N. Realm-correct constructor
    // (`this.view`) for the iframe-hosted playground.
    this.observer ??= new this.view.MutationObserver((records) => {
      const touchedOptions = records.some((rec) =>
        [...rec.addedNodes, ...rec.removedNodes].some(
          (n) =>
            n.nodeName === "A-RADIO" ||
            (n as Element).querySelector?.("a-radio") != null,
        ),
      );
      if (touchedOptions) this.sync();
    });
    this.observer.observe(this, { childList: true, subtree: true });

    // First sync a microtask later — see `childrenReady`. `alive` flips only
    // after that sync so the initial apply still never fires `change`.
    queueMicrotask(() => {
      if (!this.isConnected) return;
      this.childrenReady = true;
      this.sync();
      this.alive = true;
    });
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

  formResetCallback() {
    // Rewind to `default-state`. Uncontrolled self-applies via sync() below; the
    // `reason: "reset"` statechange lets a controller (the RadioGroup wrapper's
    // mirror, or the app) follow without mistaking it for a user pick.
    const next = this.getAttribute("default-state");
    this.emitStateChange(next, this.#currentValue, "reset", false);
    this.uncontrolledValue = next;
    this.sync();
  }

  formStateRestoreCallback(state: string) {
    // bfcache / autofill restore changes selection without a user pick — emit a
    // `reason: "restore"` statechange so the wrapper's roving-tabindex mirror (and
    // any app controller) re-syncs instead of diverging from the restored dot.
    this.emitStateChange(state, this.#currentValue, "restore", false);
    this.uncontrolledValue = state;
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

  get #radios() {
    return Array.from(this.querySelectorAll("a-radio")) as ARadioElement[];
  }

  private sync = () => {
    if (!this.childrenReady) return; // children may not be upgraded yet — the deferred first sync covers this
    const value = this.#currentValue;
    const radios = this.#radios;
    // `null` (attribute absent) means "nothing selected"; an empty string is a
    // *real* value (a legitimate `value=""` option), so only the null check guards.
    const selectedEl = radios.find((r) => r.value === value && value != null) ?? null;

    // Submit (and seed bfcache with) the *resolved* radio's value, not the raw
    // `value` — so a value with no matching option (e.g. the selected option was
    // removed) submits nothing rather than a phantom string.
    const submitted = selectedEl ? selectedEl.value : null;
    this.internals?.setFormValue(submitted, submitted);

    // Selection, off-DOM: set the `selected` *property* on each radio; the radio
    // turns that into :state(selected) + aria-checked via its own internals.
    for (const r of radios) r.selected = r === selectedEl;

    // Roving focus, off-DOM: point the group's aria-activedescendant at the
    // selected radio (see the header note). Feature-guarded — element-reference
    // ARIA reflection is Baseline-2025; absent it, the wrapper's roving `tabindex`
    // is what carries focus.
    if (this.internals && "ariaActiveDescendantElement" in this.internals) {
      this.internals.ariaActiveDescendantElement = selectedEl;
    }
  };

  // The shared state algorithm: fire the cancelable `statechange` *before*
  // applying. Controlled never self-applies; uncontrolled applies unless vetoed.
  private requestSelect(next: string) {
    const prev = this.#currentValue;
    if (next === prev) return;
    const ok = this.emitStateChange(next, prev, "user", true);
    if (this.hasAttribute("state")) return;
    if (ok) {
      this.uncontrolledValue = next;
      this.sync();
      this.emitChange();
    }
  }

  // Native `change`, fired *after* a selection applies (user pick or a controlled
  // `state` update) — the post-apply counterpart to the cancelable, pre-apply
  // `statechange`. Bubbles like a native radio group.
  private emitChange() {
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Dispatch the shared `statechange` event. `reason` lets a controller tell a
   *  user pick (cancelable) apart from a form `reset` / bfcache `restore` (not).
   *  `next` is `null` when nothing is selected (no default / reset-to-none).
   *  Neither bubbles nor composed — a point-to-point request to this element's
   *  own wrapper, not a notification (see STATEFUL-COMPONENTS.md). */
  private emitStateChange(
    next: string | null,
    prev: string | null,
    reason: "user" | "reset" | "restore",
    cancelable: boolean,
  ): boolean {
    return this.dispatchEvent(
      new CustomEvent("statechange", {
        cancelable,
        detail: { next, prev, reason },
      }),
    );
  }

  private onClick = (e: MouseEvent) => {
    if (this.#isDisabled) return;
    const radio = (e.target as HTMLElement | null)?.closest(
      "a-radio",
    ) as ARadioElement | null;
    if (!radio || radio.hasAttribute("disabled")) return;
    // Move real focus to the clicked radio. A no-op in raw/aria-activedescendant
    // mode (the radio has no tabindex); a real move in the wrapper's roving mode.
    radio.focus();
    this.requestSelect(radio.value);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.#isDisabled) return;
    const enabled = this.#radios.filter((r) => !r.hasAttribute("disabled"));
    if (enabled.length === 0) return;
    const focused = (e.target as HTMLElement | null)?.closest(
      "a-radio",
    ) as ARadioElement | null;

    if (e.key === " " || e.key === "Enter") {
      if (focused && enabled.includes(focused)) {
        e.preventDefault();
        this.requestSelect(focused.value);
      }
      return;
    }

    const forward = e.key === "ArrowDown" || e.key === "ArrowRight";
    const back = e.key === "ArrowUp" || e.key === "ArrowLeft";
    if (!forward && !back) return;
    e.preventDefault();

    // Index of the currently-focused / currently-selected option, then step.
    let i = focused ? enabled.indexOf(focused) : -1;
    if (i === -1) i = enabled.findIndex((r) => r.value === this.#currentValue);
    if (i === -1) i = 0;

    const next =
      enabled[(i + (forward ? 1 : -1) + enabled.length) % enabled.length];
    // Selection follows focus (WAI-ARIA radio pattern): move focus, then request
    // the pick. `.focus()` moves real focus in roving mode; in raw mode it no-ops
    // and the sync()'d aria-activedescendant is what advances for AT.
    next.focus();
    this.requestSelect(next.value);
  };
}

export function register_a_radio_group() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-radio-group"))
    customElements.define("a-radio-group", ARadioGroupElement);
}
register_a_radio_group();
