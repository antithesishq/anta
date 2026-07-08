import { SelectableChildElement } from "../anta_helpers";
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
// All of that (the property/attribute contract, the ON-only connect seed that stops
// the group's initial selection being clobbered) lives in SelectableChildElement,
// shared with <a-tab>; this class only pins the ARIA property to `aria-checked`
// (role="radio" comes from the wrapper, which gives it something to attach to).
//
// Focus/`tabindex` is deliberately NOT this element's concern: in the JSX wrapper
// path the wrapper renders a roving `tabindex` declaratively; in raw hand-assembly
// the group is the tab stop and uses aria-activedescendant. See a-radio-group.ts.
// ─────────────────────────────────────────────────────────────────────────────
export class ARadioElement extends SelectableChildElement {
  protected ariaProp = "ariaChecked" as const;
}

export function register_a_radio() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-radio"))
    customElements.define("a-radio", ARadioElement);
}
register_a_radio();
