import { register_a_progress } from "./a-progress";
import { register_a_text } from "./a-text";
import { register_a_icon } from "./a-icon";
import "./a-progress.css";
import "./a-text.css";
import "./a-icon.css";
import "./a-icon.shapes.css";
import { AProgressElement, register_a_progress as register_a_progress2 } from "./a-progress";
import { ATextElement, register_a_text as register_a_text2 } from "./a-text";
import { AIconElement, register_a_icon as register_a_icon2 } from "./a-icon";
if (typeof customElements !== "undefined") {
  register_a_progress();
  register_a_text();
  register_a_icon();
}
export {
  AIconElement,
  AProgressElement,
  ATextElement,
  register_a_icon2 as register_a_icon,
  register_a_progress2 as register_a_progress,
  register_a_text2 as register_a_text
};
