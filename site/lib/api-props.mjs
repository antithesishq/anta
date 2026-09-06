/** Only DOM-forwarding props belong in the inherited-props reference. */
export function isBaseProp(prop, fromBase = false) {
  const source = prop.inheritedFrom?.qualifiedName ?? prop.inheritedFrom?.name ?? ''
  return fromBase || /^(?:BaseProps|BaseAttributes|DOMEventHandlers)\./.test(source)
}
