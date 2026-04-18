import React from "react";
let _jsx = React.createElement;
let _Fragment = React.Fragment;
function configure(jsx2, Fragment) {
  _jsx = jsx2;
  if (Fragment !== void 0) _Fragment = Fragment;
}
function jsx(type, props, key) {
  const { children, ...rest } = props ?? {};
  const p = key !== void 0 ? { ...rest, key } : rest;
  if (children !== void 0) {
    return _jsx(type, p, children);
  }
  return _jsx(type, p);
}
function jsxs(type, props, key) {
  const { children, ...rest } = props ?? {};
  const p = key !== void 0 ? { ...rest, key } : rest;
  if (children !== void 0) {
    return _jsx(type, p, ...children);
  }
  return _jsx(type, p);
}
export {
  _Fragment as Fragment,
  configure,
  jsx,
  jsxs
};
