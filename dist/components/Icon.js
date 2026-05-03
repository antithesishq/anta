import { jsx } from "@antadesign/anta/jsx-runtime";
const Icon = ({ shape, size, className, style, ...rest }) => {
  const sizedStyle = size != null ? { ...style, ["--icon-size"]: `${size}px` } : style;
  return /* @__PURE__ */ jsx(
    "a-icon",
    {
      shape,
      class: className,
      style: sizedStyle,
      ...rest
    }
  );
};
export {
  Icon
};
