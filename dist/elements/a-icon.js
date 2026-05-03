import { HTMLElementBase } from "../anta_helpers";
class AIconElement extends HTMLElementBase {
}
function register_a_icon() {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("a-icon")) {
    customElements.define("a-icon", AIconElement);
  }
}
export {
  AIconElement,
  register_a_icon
};
