import { HTMLElementBase } from "../anta_helpers";
import "./a-checkbox.css";

type CheckboxState = "checked" | "unchecked" | "indeterminate";

const parseState = (v: string | null): CheckboxState =>
  v === "checked" || v === "indeterminate" ? v : "unchecked";

/**
 * `<a-checkbox>` — interactive light-DOM checkbox. Visual state lives on
 * `ElementInternals` (CSS keys off `:state(checked)` / `:state(indeterminate)`),
 * never on host attributes. The element **publishes `aria-checked` itself**, via
 * `ElementInternals` (off the DOM), so it stays live as the element self-toggles
 * uncontrolled — the wrapper does NOT set `aria-checked`. Other ARIA (`role`,
 * `aria-label`) is still the wrapper's / consumer's job.
 *
 * One ternary state — `checked` / `unchecked` / `indeterminate` — carried by two
 * attributes: `state` is the **controlled** live value (the element reflects
 * changes to it), `default-state` is the **uncontrolled** seed (read at connect /
 * form-reset, and re-applied if it changes while the checkbox is still uncontrolled
 * and un-toggled — matching a native `<input>`, whose `checked` attribute reflects
 * until the control is "dirtied" by interaction; once toggled, later `default-state`
 * changes are ignored). No "controlled" flag — the attribute name carries the intent
 * (`controlled ≡ hasAttribute('state')`).
 *
 * Follows the shared state contract (see `STATEFUL-COMPONENTS.md`): on
 * interaction the element fires a cancelable `statechange` *before* applying.
 * Controlled callers re-assert `state` from their store; uncontrolled callers
 * can veto a transition synchronously with `event.preventDefault()`. No
 * optimistic self-paint.
 */
export class ACheckboxElement extends HTMLElementBase {
  static formAssociated = true;
  static observedAttributes = ["state", "default-state", "value"];

  private internals?: ElementInternals;
  private currentState: CheckboxState = "unchecked";
  private seeded = false;
  // Set once the user toggles an uncontrolled checkbox — the native "dirty checked
  // flag". After it's set, a changed `default-state` no longer re-seeds the display.
  private dirty = false;
  // True after the first connect. Gates the native `change` event so it never
  // fires for the initial attribute seed (only for real, post-connect transitions).
  private alive = false;

  /** Current checked state as a boolean (native-`<input>`-like). `indeterminate`
   *  reads false here; check `.indeterminate` for the mixed state. */
  get checked(): boolean {
    return this.currentState === "checked";
  }
  /** Whether the checkbox is in the indeterminate ("mixed") state. */
  get indeterminate(): boolean {
    return this.currentState === "indeterminate";
  }

  constructor() {
    super();
    this.internals = this.attachInternals?.();
    this.addEventListener("click", (e: MouseEvent) => this.toggle(e));
    this.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        this.click();
      }
    });
  }

  connectedCallback() {
    // Seed only on the FIRST connect. An uncontrolled checkbox must keep the
    // user's toggled state across DOM moves / re-parents (a list reorder, a keyed
    // move, a detach+reattach, a worker re-render) — re-seeding from `default-state`
    // every connect would silently reset it, unlike a native checkbox. Controlled
    // updates still arrive via attributeChangedCallback; `formResetCallback`
    // re-seeds on purpose (a reset *should* restore the default).
    if (!this.seeded) {
      this.seed();
      this.seeded = true;
    }
    this.paint();
    this.alive = true;
  }

  attributeChangedCallback(name: string) {
    // `state` is the controlled channel — reflect changes, and fire `change` on a
    // real transition (the consumer's accepted value), like a native input.
    if (name === "state") {
      const next = parseState(this.getAttribute("state"));
      const changed = next !== this.currentState;
      this.currentState = next;
      this.paint();
      if (changed && this.alive) this.emitChange();
      return;
    }
    // `default-state` is the uncontrolled seed: re-apply it while the checkbox is
    // still uncontrolled and un-toggled (native dirty-flag semantics), so flipping
    // it before any interaction updates the display — silently, since a native
    // input's `checked` attribute reflection doesn't fire `change`. Once dirtied —
    // or once `state` is present — later changes are ignored. (`value` only
    // re-syncs the form entry.)
    if (name === "default-state" && !this.#isControlled && !this.dirty) this.seed();
    this.paint();
  }

  // Matches the host `disabled` attribute and an ancestor `<fieldset disabled>`.
  get #isDisabled() {
    return this.matches(":disabled");
  }
  // Controlled mode: the `state` attribute is present and owns the live value.
  get #isControlled() {
    return this.hasAttribute("state");
  }

  private seed() {
    this.currentState = parseState(
      this.getAttribute("state") ?? this.getAttribute("default-state"),
    );
  }

  // Native `change`, fired *after* a value transition applies (user toggle or a
  // controlled `state` update) — the post-apply counterpart to the cancelable,
  // pre-apply `statechange`. Bubbles like a native checkbox; not composed (the
  // element is light-DOM, so it reaches a wrapping form / listener directly).
  private emitChange() {
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  private toggle(_e: Event) {
    if (this.#isDisabled) return;
    const prev = this.currentState;
    // Indeterminate resolves to checked; otherwise flip (native convention).
    const next: CheckboxState = prev === "checked" ? "unchecked" : "checked";
    const ok = this.dispatchEvent(
      new CustomEvent("statechange", {
        cancelable: true,
        bubbles: true,
        composed: true,
        detail: { next, prev },
      }),
    );
    // Controlled: never self-apply — wait for the consumer to update `state`.
    // Uncontrolled: apply unless a listener synchronously preventDefault()'d.
    if (this.#isControlled) return;
    if (ok) {
      this.currentState = next;
      this.dirty = true;
      this.paint();
      this.emitChange();
    }
  }

  private paint() {
    const i = this.internals;
    if (!i) return;
    i.states.delete("checked");
    i.states.delete("indeterminate");
    if (this.currentState === "indeterminate") i.states.add("indeterminate");
    else if (this.currentState === "checked") i.states.add("checked");
    // Publish aria-checked off-DOM via ElementInternals (like a-radio), so it stays
    // live as the element self-toggles in *uncontrolled* mode — a wrapper-set
    // aria-checked would go stale there (it only re-renders for controlled changes).
    i.ariaChecked =
      this.currentState === "indeterminate"
        ? "mixed"
        : this.currentState === "checked"
          ? "true"
          : "false";
    // Submit value/"on" when checked, nothing otherwise; 2nd arg is the bfcache state.
    i.setFormValue?.(
      this.currentState === "checked" ? (this.getAttribute("value") ?? "on") : null,
      this.currentState,
    );
  }

  formResetCallback() {
    this.seed();
    this.paint();
  }

  formStateRestoreCallback(state: string) {
    this.currentState = parseState(state);
    this.paint();
  }

  formDisabledCallback() {
    this.paint();
  }
}

export function register_a_checkbox() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-checkbox"))
    customElements.define("a-checkbox", ACheckboxElement);
}

register_a_checkbox();
