function hasChildren(children) {
  return Array.isArray(children) ? children.length > 0 : children != null;
}
export {
  hasChildren
};
