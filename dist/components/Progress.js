import { jsx, jsxs } from "anta/jsx-runtime";
import cn from "classnames";
import css from "./Progress.module.css";
import { hasChildren } from "../anta_helpers";
const Progress = ({ value, max = 100, tone, label, hint, className, children, ...rest }) => {
  const percent = max > 0 ? Math.round(Math.min(100, value / max * 100)) : 0;
  return /* @__PURE__ */ jsx(
    "a-progress",
    {
      value,
      max,
      tone,
      class: cn(css.container, className),
      ...rest,
      children: hasChildren(children) ? children : /* @__PURE__ */ jsxs("a-progress-label", { children: [
        /* @__PURE__ */ jsxs("a-progress-number", { children: [
          percent,
          "%"
        ] }),
        label != null && /* @__PURE__ */ jsx("a-progress-text", { children: label }),
        hint != null && /* @__PURE__ */ jsx("a-progress-hint", { children: hint })
      ] })
    }
  );
};
export {
  Progress
};
