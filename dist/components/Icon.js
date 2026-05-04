import { jsx } from "@antadesign/anta/jsx-runtime";
const Icon = ({ shape, size, label, className, style, ...rest }) => {
  const sizedStyle = size != null ? { ...style, ["--icon-size"]: `${size}px` } : style;
  const a11y = label != null ? { role: "img", "aria-label": label } : { "aria-hidden": "true" };
  return /* @__PURE__ */ jsx(
    "a-icon",
    {
      shape,
      class: className,
      style: sizedStyle,
      ...a11y,
      ...rest
    }
  );
};
export {
  Icon
};
