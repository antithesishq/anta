import { jsx } from "@antadesign/anta/jsx-runtime";
const Text = ({ priority, tone, inline, truncate, expandable, className, style, children, ...rest }) => {
  const lineCount = typeof truncate === "number" ? truncate : truncate ? 1 : null;
  const computedStyle = lineCount != null ? { ...style, ["--line-clamp"]: lineCount } : style;
  return /* @__PURE__ */ jsx(
    "a-text",
    {
      priority,
      tone,
      inline: inline ? "" : void 0,
      truncate: lineCount != null ? String(lineCount) : void 0,
      expandable: expandable && truncate ? "" : void 0,
      class: className,
      style: computedStyle,
      ...rest,
      children
    }
  );
};
export {
  Text
};
