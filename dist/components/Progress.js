import { jsx, jsxs } from "anta/jsx-runtime";
import { hasChildren } from "../anta_helpers";
const Progress = ({ value, max = 100, tone, label, hint, className, children, ...rest }) => {
  const percent = max > 0 ? Math.round(Math.min(100, Math.max(0, value / max * 100))) : 0;
  return /* @__PURE__ */ jsx(
    "a-progress",
    {
      value,
      max,
      tone,
      class: className,
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
