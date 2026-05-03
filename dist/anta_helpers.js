function hasChildren(children) {
  return Array.isArray(children) ? children.length > 0 : children != null;
}
const HTMLElementBase = typeof HTMLElement !== "undefined" ? HTMLElement : class {
};
export {
  HTMLElementBase,
  hasChildren
};
