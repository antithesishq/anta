import { HTMLElementBase } from "../anta_helpers";
import "./a-switch.css";

type SwitchState = "checked" | "unchecked";

const parseState = (value: string | null): SwitchState =>
  value === "checked" ? "checked" : "unchecked";

/**
 * `<a-switch>` — a form-associated binary control for an immediate setting.
 * State is held in ElementInternals, so the checked visual is available to CSS
 * through `:state(checked)` without exposing a mutable host attribute. `state`
 * is the controlled value; `default-state` is the uncontrolled initial value.
 */
export class ASwitchElement extends HTMLElementBase {
  static formAssociated = true;
  static observedAttributes = ["state", "default-state", "value"];

  private internals?: ElementInternals;
  private currentState: SwitchState = "unchecked";
  private seeded = false;
  private dirty = false;
  private alive = false;

  /** Current checked value. Write through the `state` attribute instead. */
  get checked(): boolean {
    return this.currentState === "checked";
  }

  constructor() {
    super();
    this.internals = this.attachInternals?.();
    this.addEventListener("click", (event: MouseEvent) => this.toggle(event));
    this.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        this.click();
      }
    });
  }

  connectedCallback() {
    if (!this.seeded) {
      this.seed();
      this.seeded = true;
    }
    this.paint();
    this.alive = true;
  }

  attributeChangedCallback(name: string) {
    if (name === "state") {
      const next = parseState(this.getAttribute("state"));
      const changed = next !== this.currentState;
      this.currentState = next;
      this.paint();
      if (changed && this.alive) this.emitChange();
      return;
    }

    if (name === "default-state" && !this.#isControlled && !this.dirty) this.seed();
    this.paint();
  }

  get #isDisabled() {
    return this.matches(":disabled");
  }

  get #isControlled() {
    return this.hasAttribute("state");
  }

  private seed() {
    this.currentState = parseState(
      this.getAttribute("state") ?? this.getAttribute("default-state"),
    );
  }

  private emitChange() {
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  private toggle(_event: Event) {
    if (this.#isDisabled) return;

    const prev = this.currentState;
    const next: SwitchState = prev === "checked" ? "unchecked" : "checked";
    const accepted = this.dispatchEvent(
      new CustomEvent("statechange", {
        cancelable: true,
        detail: { next, prev },
      }),
    );

    if (this.#isControlled) return;
    if (!accepted) return;

    this.currentState = next;
    this.dirty = true;
    this.paint();
    this.emitChange();
  }

  private paint() {
    const internals = this.internals;
    if (!internals) return;

    internals.states.delete("checked");
    if (this.currentState === "checked") internals.states.add("checked");
    internals.ariaChecked = this.currentState === "checked" ? "true" : "false";
    internals.setFormValue?.(
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

export function register_a_switch() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-switch")) customElements.define("a-switch", ASwitchElement);
}

register_a_switch();
