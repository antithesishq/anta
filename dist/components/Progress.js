import { jsx, jsxs } from "@antadesign/anta/jsx-runtime";
import { hasChildren } from "../anta_helpers";
const Progress = ({ value, max = 100, tone, label, hint, className, children, ...rest }) => {
  const percent = max > 0 ? Math.round(Math.min(100, Math.max(0, value / max * 100))) : 0;
  const ariaLabel = [label, `${percent}%`, hint].filter(Boolean).join(" \xB7 ") || void 0;
  return /* @__PURE__ */ jsx(
    "a-progress",
    {
      value,
      max,
      tone,
      role: "progressbar",
      "aria-valuenow": value,
      "aria-valuemax": max,
      "aria-label": ariaLabel,
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
