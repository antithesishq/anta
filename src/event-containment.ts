const CONTAINED_EVENT_TYPES = new Set([
  'pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'pointerover', 'pointerout',
  'gotpointercapture', 'lostpointercapture',
  'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout',
  'click', 'dblclick', 'auxclick', 'contextmenu',
  'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel',
])

/** Whether input originated inside a contained Tooltip before reaching the
 * current handler. Use this guard before a native parent handler cancels or
 * captures input. Pass `boundary` to check against a different handling surface.
 * Keyboard and focus events are excluded.
 */
export function isContainedEvent(event: Event, boundary: EventTarget | null = event.currentTarget): boolean {
  if (!CONTAINED_EVENT_TYPES.has(event.type)) return false
  for (const target of event.composedPath()) {
    if (target === boundary) break
    const element = target as Element
    if (element.nodeType === 1 && element.localName === 'a-tooltip' && element.hasAttribute('contain-events')) return true
  }
  return false
}
