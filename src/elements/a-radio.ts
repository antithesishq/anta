import { HTMLElementBase } from "../anta_helpers";
import "./a-radio.css";

// ─────────────────────────────────────────────────────────────────────────────
// <a-radio> — one option. Presentational: it owns no selection logic, no keyboard,
// no form value — the enclosing <a-radio-group> coordinates all of that.
//
// Its one job is to render its own selected state OFF the DOM: the group sets the
// `selected` *property* (never an attribute), and the radio mirrors that into a
// `:state(selected)` custom state (the CSS hook) and `aria-checked` via its OWN
// ElementInternals. So the group can drive selection without writing any attribute
// to the radio — which is what keeps the whole control free of DOM mutation.
//
// Focus/`tabindex` is deliberately NOT this element's concern: in the JSX wrapper
// path the wrapper renders a roving `tabindex` declaratively; in raw hand-assembly
// the group is the tab stop and uses aria-activedescendant. See a-radio-group.ts.
// ─────────────────────────────────────────────────────────────────────────────
export class ARadioElement extends HTMLElementBase {
  static observedAttributes = ["selected"];
  private internals?: ElementInternals;

  constructor() {
    super();
    this.internals = this.attachInternals?.();
  }

  connectedCallback() {
    // Reflect a hand-authored `selected` attribute as the initial paint; the
    // enclosing <a-radio-group> observes child add/remove and drives selection
    // thereafter (its MutationObserver catches this radio appearing).
    //
    // Only ever turn state ON here — never force it OFF. Under eager element
    // registration the group connects first (parent-before-child tree order) and
    // has already set `selected` via the property by the time this runs; forcing
    // OFF for an absent attribute would silently clobber that initial
    // `default-state` selection (the dot never paints even though the group's
    // value is correct). The resting internals state is already "not selected",
    // so there is nothing to reset. Mirrors a-tab's connectedCallback guard.
    if (this.hasAttribute("selected")) this.applyState(true);
  }

  attributeChangedCallback(name: string) {
    if (name === "selected") this.applyState(this.hasAttribute("selected"));
  }

  get selected(): boolean {
    return this.internals?.states.has("selected") ?? this.hasAttribute("selected");
  }
  set selected(on: boolean) {
    this.applyState(!!on);
  }

  get value(): string {
    return this.getAttribute("value") ?? "";
  }

  // `selected` is the single source: it drives the visual `:state(selected)` and
  // publishes `aria-checked` through ElementInternals (the accessibility tree,
  // not a DOM attribute). The group only sets `r.selected`; the radio owns how it
  // reflects that. role="radio" comes from the wrapper, which gives ariaChecked
  // something to attach to.
  private applyState(on: boolean) {
    if (!this.internals) return;
    if (on) this.internals.states.add("selected");
    else this.internals.states.delete("selected");
    this.internals.ariaChecked = on ? "true" : "false";
  }
}

export function register_a_radio() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-radio"))
    customElements.define("a-radio", ARadioElement);
}
register_a_radio();
