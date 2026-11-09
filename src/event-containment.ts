/** @internal Input types shared by cooperative and native containment. */
export const CONTAINED_EVENT_TYPES: readonly string[] = Object.freeze([
  'pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'pointerover', 'pointerout',
  'gotpointercapture', 'lostpointercapture',
  'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout',
  'click', 'dblclick', 'auxclick', 'contextmenu',
  'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel',
])

const containedEventTypes = new Set(CONTAINED_EVENT_TYPES)

/** @internal Reconcile native bubble listeners without changing default actions.
 * Pass an empty iterable when the owning component disconnects. */
export function createPropagationStopper(target: EventTarget): (types: Iterable<string>) => void {
  let current = new Set<string>()
  const stop = (event: Event) => event.stopPropagation()
  return types => {
    const next = new Set(types)
    for (const type of current) {
      if (!next.has(type)) target.removeEventListener(type, stop)
    }
    for (const type of next) {
      if (!current.has(type)) target.addEventListener(type, stop, { passive: true })
    }
    current = next
  }
}

/** Whether input originated inside a contained Tooltip before reaching the
 * current handler. Use this guard before a native parent handler cancels or
 * captures input. Pass `boundary` to check against a different handling surface.
 * Keyboard and focus events are excluded.
 */
export function isContainedEvent(event: Event, boundary: EventTarget | null = event.currentTarget): boolean {
  if (!containedEventTypes.has(event.type)) return false
  for (const target of event.composedPath()) {
    if (target === boundary) break
    const element = target as Element
    if (element.nodeType === 1 && element.localName === 'a-tooltip' && element.hasAttribute('contain-events')) return true
  }
  return false
}
