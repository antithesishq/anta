import { isFocusable, tabbable } from 'tabbable'

export type FocusTarget = HTMLElement | SVGElement
const options = { getShadowRoot: true }

export function activeFocus(doc: Document): Element | null {
  let active = doc.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return active
}

/** Follow rendered ancestry through slots and shadow roots. */
export function focusParent(node: Node): Node | null {
  if (node.nodeType === 1 && (node as Element).assignedSlot) return (node as Element).assignedSlot
  const parent = node.parentNode
  return parent?.nodeType === 11 && 'host' in parent ? (parent as ShadowRoot).host : parent
}

export function containsFocus(scope: Element, node: Node | null): boolean {
  while (node) {
    if (node === scope) return true
    node = focusParent(node)
  }
  return false
}

export function canFocus(node: Element | null): node is FocusTarget {
  return !!node && 'focus' in node && isFocusable(node, options)
}

export function tabStops(scope: Element): FocusTarget[] {
  return tabbable(scope, options)
}

/** Cycle through rendered Tab stops, optionally focusing an empty scope. */
export function cycleFocus(nodes: FocusTarget[], current: Element | null, backward: boolean, fallback?: FocusTarget): boolean {
  const index = nodes.indexOf(current as FocusTarget)
  const next = index < 0 ? (backward ? nodes.length - 1 : 0)
    : (index + (backward ? -1 : 1) + nodes.length) % nodes.length
  const target = nodes[next] ?? fallback
  if (!target) return false
  target.focus()
  return true
}
