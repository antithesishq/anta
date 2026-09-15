import { finiteNumber } from '../anta_helpers'
import type {
  CaptureInputCancelReason, CaptureInputGeometry, CaptureInputModifier, CapturePanInput,
  CapturePointerActivationReason, CapturePointerInput, CapturePointerStart,
  CaptureWheelActivation, CaptureWheelActivationReason, CaptureWheelInput,
  SerializedMouseEvent, SerializedPointerEvent, SerializedWheelEvent,
} from '../capture-types'

export const CAPTURE_INPUT_ATTRIBUTES = [
  'wheel-capture', 'wheel-activation', 'wheel-modifier', 'wheel-delay', 'wheel-tolerance', 'wheel-reset-on-move',
  'pointer-capture', 'pointer-buttons', 'pointer-threshold', 'pointer-modifier', 'pointer-include-interactive',
  'pan', 'pan-pointer-types', 'pan-threshold', 'pan-directions', 'pan-inertia', 'pan-time-constant', 'pan-min-velocity',
]

type View = Window & typeof globalThis
type Point = { x: number; y: number; time: number }
type WheelOptions = {
  directions: number; activation: CaptureWheelActivation; modifier: CaptureInputModifier
  delay: number; tolerance: number; resetOnMove: boolean
}
type PointerOptions = { types: number; buttons: number; threshold: number; modifier: CaptureInputModifier; interactive: boolean }
type PanOptions = { types: number; axis: string; threshold: number; directions: number; inertia: boolean; tau: number; minVelocity: number }
type InputState = {
  surface: HTMLElement; store: InputStore
  wheel?: WheelOptions; pointer?: PointerOptions; pan?: PanOptions
  session?: PointerSession; momentum?: Momentum; suppressClickUntil?: number
}
type PointerSession = {
  state: InputState; id: number; start: CapturePointerStart; current: SerializedPointerEvent
  pointer: boolean; pan: boolean; pointerStarted: boolean; panStarted: boolean; captured: boolean
  pointerReason: CapturePointerActivationReason; panReason: CapturePointerActivationReason
  pointerLast: Point; panLast: Point; samples: Point[]; lastMoveTime: number
}
type Momentum = { state: InputState; session: PointerSession; vx: number; vy: number; time: number }
type PanMotion = Partial<Pick<CapturePanInput, 'deltaX' | 'deltaY' | 'velocityX' | 'velocityY' | 'cancelReason'>>
type InputStore = {
  doc: Document; view: View; states: Set<InputState>; dwell: Map<HTMLElement, Point>
  sessions: Map<number, PointerSession>; momenta: Set<Momentum>
  tracking: boolean; listening: boolean; frame?: number; animate?: FrameRequestCallback
}

// Plain capture surfaces never enter either map. Listeners use shared functions.
const inputs = new WeakMap<HTMLElement, InputState>()
const documents = new WeakMap<Document, InputStore>()
const DIRECTIONS: Record<string, number> = { up: 1, down: 2, left: 4, right: 8 }
const POINTER_TYPES: Record<string, number> = { mouse: 1, pen: 2, touch: 4 }
const WHEEL_CONTROLS = 'textarea, select, input[type="number"], input[type="range"], a-menu'
const INTERACTIVE = [
  'input, textarea, select, button, summary, a[href], [contenteditable]:not([contenteditable="false"])',
  ...[
    'button', 'checkbox', 'combobox', 'link', 'menuitem', 'menuitemcheckbox',
    'menuitemradio', 'option', 'radio', 'scrollbar', 'searchbox', 'slider',
    'spinbutton', 'switch', 'tab', 'textbox', 'treeitem',
  ].map(role => `[role~="${role}"]`),
  'a-input, a-button, a-slider, a-checkbox, a-switch, a-radio, a-menu, a-menu-item, a-tab',
].join(', ')

function mask(value: string | null, values: Record<string, number>, fallback: number): number {
  if (value === null || value === '') return fallback
  if (value === 'all') return Object.values(values).reduce((result, bit) => result | bit, 0)
  return value.trim().split(/\s+/).reduce((result, key) => result | (values[key] ?? 0), 0)
}

function numberAttr(surface: HTMLElement, name: string, fallback: number, min = 0): number {
  return Math.max(min, finiteNumber(surface.getAttribute(name)?.trim() ?? null, fallback))
}

function modifierAttr(surface: HTMLElement, name: string, fallback: CaptureInputModifier): CaptureInputModifier {
  const value = surface.getAttribute(name)
  return value === 'any' || value === 'none' || value === 'alt' || value === 'ctrl' || value === 'meta' || value === 'shift' ? value : fallback
}

function readWheel(surface: HTMLElement): WheelOptions | undefined {
  if (!surface.hasAttribute('wheel-capture')) return
  // Empty bounds preserve pointer dwell until a direction becomes available.
  const directions = mask(surface.getAttribute('wheel-capture'), DIRECTIONS, 15)
  const activation = surface.getAttribute('wheel-activation')
  return {
    directions,
    activation: activation === 'hover' || activation === 'focus' || activation === 'settled-or-focus' ? activation : 'settled',
    modifier: modifierAttr(surface, 'wheel-modifier', 'none'),
    delay: numberAttr(surface, 'wheel-delay', 150),
    tolerance: numberAttr(surface, 'wheel-tolerance', 5),
    resetOnMove: surface.hasAttribute('wheel-reset-on-move'),
  }
}

function readPointer(surface: HTMLElement): PointerOptions | undefined {
  if (!surface.hasAttribute('pointer-capture')) return
  const types = mask(surface.getAttribute('pointer-capture'), POINTER_TYPES, 7)
  if (!types) return
  const buttonAttribute = surface.getAttribute('pointer-buttons')
  const buttons = buttonAttribute === null ? 1 : buttonAttribute.split(/\s+/).reduce((bits, button) => {
    const n = Number(button)
    return Number.isInteger(n) && n >= 0 && n <= 5 ? bits | (1 << n) : bits
  }, 0)
  if (!buttons) return
  return {
    types, buttons,
    threshold: numberAttr(surface, 'pointer-threshold', 0),
    modifier: modifierAttr(surface, 'pointer-modifier', 'any'),
    interactive: surface.hasAttribute('pointer-include-interactive'),
  }
}

function readPan(surface: HTMLElement): PanOptions | undefined {
  if (!surface.hasAttribute('pan')) return
  const axis = surface.getAttribute('pan')
  if (axis !== '' && axis !== 'both' && axis !== 'x' && axis !== 'y') return
  const types = mask(surface.getAttribute('pan-pointer-types'), POINTER_TYPES, 4)
  if (!types) return
  return {
    types, axis: axis || 'both', threshold: numberAttr(surface, 'pan-threshold', 3),
    directions: mask(surface.getAttribute('pan-directions'), DIRECTIONS, 15),
    inertia: surface.hasAttribute('pan-inertia'),
    tau: numberAttr(surface, 'pan-time-constant', 325, 1),
    minVelocity: numberAttr(surface, 'pan-min-velocity', 0.02, 0.001),
  }
}

function inputStore(surface: HTMLElement): InputStore {
  const doc = surface.ownerDocument
  let store = documents.get(doc)
  if (store) return store
  const view = doc.defaultView as View
  store = { doc, view, states: new Set(), dwell: new Map(), sessions: new Map(), momenta: new Set(), tracking: false, listening: false }
  documents.set(doc, store)
  view.addEventListener('blur', onWindowBlur)
  doc.addEventListener('visibilitychange', onVisibilityChange)
  return store
}

/** Read declarative attributes, allocating input resources only for enabled capabilities. */
export function syncCaptureInput(surface: HTMLElement, attribute?: string) {
  if (!surface.isConnected || !surface.ownerDocument.defaultView) return
  let state = inputs.get(surface)
  if (!state && !surface.hasAttribute('wheel-capture') && !surface.hasAttribute('pointer-capture') && !surface.hasAttribute('pan')) return
  const wheel = readWheel(surface)
  const pointer = readPointer(surface)
  const pan = readPan(surface)
  if (!wheel && !pointer && !pan) {
    disconnectCaptureInput(surface, 'disabled')
    return
  }
  if (!state) {
    state = { surface, store: inputStore(surface) }
    inputs.set(surface, state)
    state.store.states.add(state)
  }
  const hadWheel = !!state.wheel
  const hadPointer = !!(state.pointer || state.pan)
  state.wheel = wheel
  state.pointer = pointer
  state.pan = pan
  if (hadWheel !== !!wheel) {
    if (wheel) surface.addEventListener('wheel', onWheel, { passive: false })
    else surface.removeEventListener('wheel', onWheel)
  }
  if (hadPointer !== !!(pointer || pan)) {
    if (pointer || pan) {
      surface.addEventListener('pointerdown', onPointerDown)
      surface.addEventListener('lostpointercapture', onLostCapture)
      surface.addEventListener('click', onClick, true)
      surface.addEventListener('dragstart', onDragStart)
    } else removePointerListeners(surface)
  }
  if (!wheel || attribute?.startsWith('wheel-') && attribute !== 'wheel-capture') state.store.dwell.delete(surface)
  if (state.session && attribute && (attribute.startsWith('pointer-') || attribute === 'pan' || attribute === 'pan-pointer-types' || attribute === 'pan-threshold')) {
    finishSession(state.session, null, 'disabled')
  }
  if (state.momentum && (!pan?.inertia || !pan.directions)) stopMomentum(state.momentum, 'disabled')
  syncDwellTracking(state.store)
}

export function disconnectCaptureInput(surface: HTMLElement, reason: CaptureInputCancelReason = 'disconnected') {
  const state = inputs.get(surface)
  if (!state) return
  inputs.delete(surface)
  state.wheel = undefined
  state.pointer = undefined
  state.pan = undefined
  surface.removeEventListener('wheel', onWheel)
  removePointerListeners(surface)
  if (state.session) finishSession(state.session, null, reason)
  if (state.momentum) stopMomentum(state.momentum, reason)
  const store = state.store
  store.dwell.delete(surface)
  store.states.delete(state)
  syncDwellTracking(store)
  if (store.states.size) return
  store.view.removeEventListener('blur', onWindowBlur)
  store.doc.removeEventListener('visibilitychange', onVisibilityChange)
  if (documents.get(store.doc) === store) documents.delete(store.doc)
}

function removePointerListeners(surface: HTMLElement) {
  surface.removeEventListener('pointerdown', onPointerDown)
  surface.removeEventListener('lostpointercapture', onLostCapture)
  surface.removeEventListener('click', onClick, true)
  surface.removeEventListener('dragstart', onDragStart)
}

function needsDwell(options?: WheelOptions) {
  return options?.activation === 'settled' || options?.activation === 'settled-or-focus'
}

function syncDwellTracking(store: InputStore) {
  const tracking = Array.from(store.states).some(state => needsDwell(state.wheel))
  if (tracking === store.tracking) return
  store.tracking = tracking
  if (tracking) {
    store.doc.addEventListener('pointermove', onDwellMove, { passive: true, capture: true })
    store.doc.addEventListener('pointerout', onDwellOut, { passive: true, capture: true })
    store.doc.addEventListener('wheel', onDwellWheel, { passive: true, capture: true })
  } else {
    store.doc.removeEventListener('pointermove', onDwellMove, true)
    store.doc.removeEventListener('pointerout', onDwellOut, true)
    store.doc.removeEventListener('wheel', onDwellWheel, true)
    store.dwell.clear()
  }
}

function onDwellMove(this: Document, event: PointerEvent) {
  const store = documents.get(this)
  if (!store || event.pointerType === 'touch') return
  const path = event.composedPath()
  for (const surface of store.dwell.keys()) {
    // Pointer capture retargets moves even after the pointer leaves Capture.
    if (!path.includes(surface) || event.buttons && !geometry(surface, event.clientX, event.clientY).inside) {
      store.dwell.delete(surface)
    }
  }
  for (const target of path) {
    const state = inputs.get(target as HTMLElement)
    const options = state?.wheel
    if (!state || !options || !needsDwell(options)) continue
    let dwell = store.dwell.get(state.surface)
    if (!dwell) {
      // Drags can update existing dwell, but cannot activate a new region.
      if (event.buttons) continue
      store.dwell.set(state.surface, { x: event.clientX, y: event.clientY, time: event.timeStamp })
      continue
    }
    if (event.clientX === dwell.x && event.clientY === dwell.y) continue
    if (event.timeStamp - dwell.time >= options.delay && !options.resetOnMove) continue
    if (Math.abs(event.clientX - dwell.x) > options.tolerance || Math.abs(event.clientY - dwell.y) > options.tolerance) {
      dwell = { x: event.clientX, y: event.clientY, time: event.timeStamp }
      store.dwell.set(state.surface, dwell)
    }
  }
}

function onDwellOut(this: Document, event: PointerEvent) {
  if (event.pointerType === 'touch') return
  if (event.relatedTarget === null) documents.get(this)?.dwell.clear()
}

function onDwellWheel(this: Document, event: WheelEvent) {
  const store = documents.get(this)
  if (!store) return
  const path = event.composedPath()
  // Wheel input invalidates old dwell; it never establishes dwell on a new region.
  for (const surface of store.dwell.keys()) if (!path.includes(surface)) store.dwell.delete(surface)
}

function matchesModifier(event: MouseEvent, modifier: CaptureInputModifier) {
  if (modifier === 'any') return true
  if (modifier === 'none') return !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
  return event[`${modifier}Key`]
}

function ignoredTarget(surface: HTMLElement, event: Event, controls: string) {
  const view = surface.ownerDocument.defaultView as View
  for (const target of event.composedPath()) {
    if (target === surface) break
    if (target instanceof view.Element && (target.hasAttribute('data-capture-ignore') || controls && target.matches(controls))) return true
  }
  return surface.hasAttribute('data-capture-ignore')
}

function allows(directions: number, delta: number, horizontal: boolean) {
  return delta !== 0 && !!(directions & (horizontal ? delta < 0 ? 4 : 8 : delta < 0 ? 1 : 2))
}

function geometry(surface: HTMLElement, x: number, y: number): CaptureInputGeometry {
  const rect = surface.getBoundingClientRect()
  return {
    localX: x - rect.left, localY: y - rect.top,
    boxWidth: rect.width, boxHeight: rect.height,
    inside: x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
    focusWithin: surface.matches(':focus-within'),
  }
}

function serializeMouse(event: MouseEvent): SerializedMouseEvent {
  return {
    type: event.type, timeStamp: event.timeStamp, isTrusted: event.isTrusted,
    cancelable: event.cancelable, defaultPrevented: event.defaultPrevented,
    altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey,
    button: event.button, buttons: event.buttons,
    clientX: event.clientX, clientY: event.clientY, pageX: event.pageX, pageY: event.pageY,
    screenX: event.screenX, screenY: event.screenY, offsetX: event.offsetX, offsetY: event.offsetY,
  }
}

function serializePointer(event: PointerEvent): SerializedPointerEvent {
  return {
    ...serializeMouse(event), pointerId: event.pointerId, pointerType: event.pointerType,
    isPrimary: event.isPrimary, width: event.width, height: event.height,
    pressure: event.pressure, tangentialPressure: event.tangentialPressure,
    tiltX: event.tiltX, tiltY: event.tiltY, twist: event.twist,
  }
}

function emit(state: InputState, type: 'wheelinput' | 'pointerinput' | 'paninput', detail: CaptureWheelInput | CapturePointerInput | CapturePanInput) {
  state.surface.dispatchEvent(new state.store.view.CustomEvent(type, { detail }))
}

function onWheel(this: HTMLElement, event: WheelEvent) {
  const state = inputs.get(this)
  const options = state?.wheel
  if (!state || !options || !options.directions || event.defaultPrevented || !event.cancelable || !matchesModifier(event, options.modifier)) return
  // Read the units before either delta (Firefox's legacy wheel compatibility).
  const deltaMode = event.deltaMode
  const deltaX = event.deltaX, deltaY = event.deltaY
  // Ownership follows the dominant axis; the complete diagonal input is forwarded unchanged.
  const horizontal = Math.abs(deltaX) > Math.abs(deltaY)
  if (!allows(options.directions, horizontal ? deltaX : deltaY, horizontal)) return
  let activationReason: CaptureWheelActivationReason
  if ((options.activation === 'focus' || options.activation === 'settled-or-focus') && this.matches(':focus-within')) activationReason = 'focus'
  else if (options.activation === 'hover') activationReason = 'immediate'
  else {
    const dwell = state.store.dwell.get(this)
    if (!needsDwell(options) || !dwell || event.timeStamp - dwell.time < options.delay) return
    activationReason = 'settled'
  }
  if (ignoredTarget(this, event, WHEEL_CONTROLS)) return
  const bounds = geometry(this, event.clientX, event.clientY)
  if (!bounds.inside) return
  event.preventDefault()
  if (!event.defaultPrevented) return
  event.stopPropagation()
  const wheelEvent: SerializedWheelEvent = { ...serializeMouse(event), deltaMode, deltaX, deltaY, deltaZ: event.deltaZ }
  if (state.momentum) stopMomentum(state.momentum, 'interrupted')
  emit(state, 'wheelinput', { wheelEvent, ...bounds, activationReason })
}

function point(event: SerializedPointerEvent | PointerEvent): Point {
  return { x: event.clientX, y: event.clientY, time: event.timeStamp }
}

function onPointerDown(this: HTMLElement, event: PointerEvent) {
  const state = inputs.get(this)
  if (!state) return
  // A new press is a new click candidate, including on an excluded child control.
  state.suppressClickUntil = undefined
  if (state.momentum) stopMomentum(state.momentum, 'interrupted')
  if (event.defaultPrevented || !event.isPrimary || state.session || state.store.sessions.has(event.pointerId)) return
  const type = POINTER_TYPES[event.pointerType] ?? 0
  const options = state.pointer
  const pointer = !!options && !!(options.types & type) && !!(options.buttons & (1 << event.button)) && matchesModifier(event, options.modifier) && !ignoredTarget(this, event, options.interactive ? '' : INTERACTIVE)
  const pan = !!state.pan && !!(state.pan.types & type) && event.button === 0 && state.pan.directions !== 0 && !ignoredTarget(this, event, INTERACTIVE)
  if (!pointer && !pan) return
  const snapshot = serializePointer(event)
  const origin = point(snapshot)
  const session: PointerSession = {
    state, id: event.pointerId, start: { pointerEvent: snapshot, ...geometry(this, event.clientX, event.clientY) }, current: snapshot,
    pointer, pan, pointerStarted: false, panStarted: false, captured: false,
    pointerReason: options?.threshold ? 'drag-threshold' : 'pointer-down',
    panReason: state.pan?.threshold ? 'drag-threshold' : 'pointer-down',
    pointerLast: origin, panLast: origin, samples: pan ? [origin] : [], lastMoveTime: event.timeStamp,
  }
  state.session = session
  state.store.sessions.set(session.id, session)
  syncSessionListeners(state.store)
  updateSession(session, event, true)
}

function syncSessionListeners(store: InputStore) {
  const listening = store.sessions.size > 0
  if (listening === store.listening) return
  store.listening = listening
  if (listening) {
    store.doc.addEventListener('pointermove', onSessionMove, { capture: true, passive: false })
    store.doc.addEventListener('pointerup', onSessionUp, { capture: true, passive: false })
    store.doc.addEventListener('pointercancel', onSessionCancel, true)
  } else {
    store.doc.removeEventListener('pointermove', onSessionMove, true)
    store.doc.removeEventListener('pointerup', onSessionUp, true)
    store.doc.removeEventListener('pointercancel', onSessionCancel, true)
  }
}

function onSessionMove(this: Document, event: PointerEvent) {
  const session = documents.get(this)?.sessions.get(event.pointerId)
  if (session) updateSession(session, event)
}
function onSessionUp(this: Document, event: PointerEvent) {
  const session = documents.get(this)?.sessions.get(event.pointerId)
  if (session) finishSession(session, event)
}
function onSessionCancel(this: Document, event: PointerEvent) {
  const session = documents.get(this)?.sessions.get(event.pointerId)
  if (session) finishSession(session, event, 'pointer-cancel')
}
function onLostCapture(this: HTMLElement, event: PointerEvent) {
  const session = inputs.get(this)?.session
  if (session?.id === event.pointerId && session.captured) finishSession(session, event, 'lost-capture')
}

function consumePointer(event: PointerEvent) {
  if (event.cancelable) event.preventDefault()
}

function recordSample(session: PointerSession, event: PointerEvent) {
  if (!session.pan) return
  const last = session.samples.at(-1)
  if (!last || last.x !== event.clientX || last.y !== event.clientY) session.lastMoveTime = event.timeStamp
  session.samples.push(point(event))
  while (session.samples.length > 8 || session.samples.length > 2 && event.timeStamp - session.samples[0].time > 100) session.samples.shift()
}

function velocity(session: PointerSession, time: number) {
  if (time - session.lastMoveTime > 80) return { x: 0, y: 0 }
  const last = session.samples.at(-1)
  const first = session.samples.find(sample => last && last.time - sample.time <= 100)
  const dt = last && first ? last.time - first.time : 0
  return dt > 0 && first && last ? { x: (first.x - last.x) / dt, y: (first.y - last.y) / dt } : { x: 0, y: 0 }
}

function panDelta(options: PanOptions, x: number, y: number) {
  return {
    x: options.axis !== 'y' && allows(options.directions, x, true) ? x : 0,
    y: options.axis !== 'x' && allows(options.directions, y, false) ? y : 0,
  }
}

function updateSession(session: PointerSession, event: PointerEvent, down = false) {
  const state = session.state
  const x = event.clientX - session.start.pointerEvent.clientX
  const y = event.clientY - session.start.pointerEvent.clientY
  const distance = Math.hypot(x, y)
  const pointerStarts = session.pointer && !session.pointerStarted && !!state.pointer && distance >= state.pointer.threshold
  const panDistance = state.pan?.axis === 'x' ? Math.abs(x) : state.pan?.axis === 'y' ? Math.abs(y) : distance
  const panStarts = session.pan && !session.panStarted && !!state.pan && panDistance >= state.pan.threshold
  if (pointerStarts || panStarts || session.captured) {
    if (!session.captured) {
      try { state.surface.setPointerCapture(session.id) } catch { finishSession(session, event, 'lost-capture'); return }
      session.captured = true
    }
    consumePointer(event)
  }
  session.current = serializePointer(event)
  if (down) session.start.pointerEvent = session.current
  if (!down) recordSample(session, event)
  if (pointerStarts) {
    session.pointerStarted = true
    emitPointer(session, 'start', session.start.pointerEvent)
    if (state.session !== session) return
  }
  if (panStarts) {
    session.panStarted = true
    emitPan(session, 'start', session.start.pointerEvent)
    if (state.session !== session) return
  }
  if (down) return
  if (session.pointerStarted) {
    emitPointer(session, 'move', session.current)
    if (state.session !== session) return
  }
  if (session.panStarted && state.pan) {
    const delta = panDelta(state.pan, session.panLast.x - event.clientX, session.panLast.y - event.clientY)
    const v = velocity(session, event.timeStamp)
    const speed = panDelta(state.pan, v.x, v.y)
    session.panLast = point(event)
    emitPan(session, 'move', session.current, { deltaX: delta.x, deltaY: delta.y, velocityX: speed.x, velocityY: speed.y })
  }
}

function emitPointer(session: PointerSession, phase: CapturePointerInput['phase'], event: SerializedPointerEvent | null, cancelReason?: CaptureInputCancelReason) {
  const current = event ?? session.current
  const start = session.start.pointerEvent
  const first = phase === 'start'
  const deltaX = first ? 0 : current.clientX - session.pointerLast.x
  const deltaY = first ? 0 : current.clientY - session.pointerLast.y
  session.pointerLast = point(current)
  emit(session.state, 'pointerinput', {
    phase, pointerEvent: event ? { ...event } : null, start: snapshotStart(session),
    ...geometry(session.state.surface, current.clientX, current.clientY), deltaX, deltaY,
    movementX: current.clientX - start.clientX, movementY: current.clientY - start.clientY,
    activationReason: session.pointerReason, ...(cancelReason ? { cancelReason } : {}),
  })
}

function emitPan(session: PointerSession, phase: CapturePanInput['phase'], event: SerializedPointerEvent | null, motion?: PanMotion) {
  const current = event ?? session.current
  emit(session.state, 'paninput', {
    phase, pointerEvent: event ? { ...event } : null, start: snapshotStart(session),
    ...geometry(session.state.surface, current.clientX, current.clientY),
    deltaX: 0, deltaY: 0, velocityX: 0, velocityY: 0,
    activationReason: session.panReason, ...motion,
  })
}

function snapshotStart(session: PointerSession): CapturePointerStart {
  return { ...session.start, pointerEvent: { ...session.start.pointerEvent } }
}

function finishSession(session: PointerSession, event: PointerEvent | null, reason?: CaptureInputCancelReason) {
  const state = session.state
  if (state.session !== session) return
  state.session = undefined
  state.store.sessions.delete(session.id)
  syncSessionListeners(state.store)
  if (event) {
    if (session.captured && !reason) consumePointer(event)
    recordSample(session, event)
    session.current = serializePointer(event)
  }
  if (state.surface.hasPointerCapture(session.id)) state.surface.releasePointerCapture(session.id)
  if (session.captured) state.suppressClickUntil = state.store.view.performance.now() + 400
  if (session.pointerStarted) emitPointer(session, reason ? 'cancel' : 'end', event ? session.current : null, reason)
  if (!session.panStarted) return
  if (reason || inputs.get(state.surface) !== state || !state.pan) {
    emitPan(session, 'cancel', event ? session.current : null, { cancelReason: reason ?? 'disabled' })
    return
  }
  const finalDelta = panDelta(state.pan, session.panLast.x - session.current.clientX, session.panLast.y - session.current.clientY)
  const v = velocity(session, session.current.timeStamp)
  const speed = panDelta(state.pan, v.x, v.y)
  emitPan(session, 'release', session.current, { deltaX: finalDelta.x, deltaY: finalDelta.y, velocityX: speed.x, velocityY: speed.y })
  const options = state.pan
  if (inputs.get(state.surface) !== state || !options || state.session) {
    emitPan(session, 'cancel', null, { cancelReason: 'disabled' })
    return
  }
  if (options.inertia && (Math.abs(speed.x) >= options.minVelocity || Math.abs(speed.y) >= options.minVelocity)) {
    const momentum: Momentum = { state, session, vx: speed.x, vy: speed.y, time: state.store.view.performance.now() }
    state.momentum = momentum
    state.store.momenta.add(momentum)
    scheduleMomentum(state.store)
  } else emitPan(session, 'end', session.current)
}

function scheduleMomentum(store: InputStore) {
  if (store.frame !== undefined || !store.momenta.size) return
  store.animate ??= time => advanceMomentum(store, time)
  store.frame = store.view.requestAnimationFrame(store.animate)
}

function advanceMomentum(store: InputStore, time: number) {
  store.frame = undefined
  for (const motion of Array.from(store.momenta)) {
    const options = motion.state.pan
    if (!options?.inertia || !motion.state.surface.isConnected) { stopMomentum(motion, 'disabled'); continue }
    const dt = Math.min(50, Math.max(0, time - motion.time))
    motion.time = time
    const decay = Math.exp(-dt / options.tau)
    const delta = panDelta(options, motion.vx * options.tau * (1 - decay), motion.vy * options.tau * (1 - decay))
    const speed = panDelta(options, motion.vx * decay, motion.vy * decay)
    motion.vx = speed.x
    motion.vy = speed.y
    if (delta.x || delta.y) emitPan(motion.session, 'inertia', null, { deltaX: delta.x, deltaY: delta.y, velocityX: speed.x, velocityY: speed.y })
    if (!store.momenta.has(motion)) continue
    if (Math.abs(speed.x) < options.minVelocity && Math.abs(speed.y) < options.minVelocity) stopMomentum(motion)
  }
  scheduleMomentum(store)
}

function stopMomentum(motion: Momentum, reason?: CaptureInputCancelReason) {
  const state = motion.state
  if (state.momentum !== motion) return
  state.momentum = undefined
  state.store.momenta.delete(motion)
  if (!state.store.momenta.size && state.store.frame !== undefined) {
    state.store.view.cancelAnimationFrame(state.store.frame)
    state.store.frame = undefined
  }
  emitPan(motion.session, reason ? 'cancel' : 'end', null, reason ? { cancelReason: reason } : undefined)
}

function onClick(this: HTMLElement, event: MouseEvent) {
  const state = inputs.get(this)
  if (!state?.suppressClickUntil || event.detail === 0 || state.store.view.performance.now() > state.suppressClickUntil) return
  state.suppressClickUntil = undefined
  event.preventDefault()
  event.stopPropagation()
}

function onDragStart(this: HTMLElement, event: Event) {
  if (inputs.get(this)?.session) event.preventDefault()
}

function cancelStore(store: InputStore) {
  store.dwell.clear()
  for (const session of Array.from(store.sessions.values())) finishSession(session, null, 'blur')
  for (const motion of Array.from(store.momenta)) stopMomentum(motion, 'blur')
}

function onWindowBlur(this: Window) {
  const store = documents.get(this.document)
  if (store) cancelStore(store)
}
function onVisibilityChange(this: Document) {
  const store = documents.get(this)
  if (store && this.hidden) cancelStore(store)
}
