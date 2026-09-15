# Capture

`Capture` is a light-DOM input surface for custom tables, plots, and drag
interactions. Wheel capture, pointer capture, and panning are all disabled by default.

## Usage

Each capability is opt-in; handlers alone enable nothing. Choose by interaction:

| Interaction | Capability | Your component handles |
| --- | --- | --- |
| Mouse wheel or trackpad scrolling | `wheelCapture` | Scroll offsets or zoom |
| Touchscreen drag to scroll | `pan` | Scroll offsets from pan deltas |
| Drag to select, resize, or draw | `pointerCapture` | Raw pointer samples |

Disabled Capture surfaces add no input state or listeners.

Capture cancels accepted native input on the browser thread, then sends plain data
to your handler. Your component performs the action. Forward the serializable
`detail` across worker boundaries. Handler return values cannot change cancellation.

For a 2D table, combine `wheelCapture` and `pan` for scrolling with
`pointerCapture={{ pointerTypes: ['mouse', 'pen'] }}` for selection. Each
handler updates the corresponding scroll or selection state.

## Wheel ownership

Set `wheelCapture` to `true` for all directions, or update allowed directions
from your component's bounds. Declined input reaches the enclosing editor or
scroll container. The dominant axis decides ownership; both deltas are delivered.
All-false bounds preserve settling while declining input. Passing `false` or
removing `wheelCapture` disables capture and clears settling.

Enable **Capture wheel**, then scroll over the rows. The controls let you try
different activation and settling rules.

```tsx title="Custom table wheel"
const [offset, setOffset] = useState(0)
const maxOffset = 28 * 32 - 192

// These settings come from the preview controls.
<div onKeyDown={event => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  const delta = event.key === 'ArrowDown' ? 32 : -32
  setOffset(value => Math.max(0, Math.min(maxOffset, value + delta)))
}}>
  <Capture
    wheelCapture={enabled && { up: offset > 0, down: offset < maxOffset }}
    wheelActivation={activation}
    wheelSettle={{ delay, tolerance: 5, resetOnMove }}
    tabIndex={0}
    aria-label="Wheel capture surface"
    style={{ height: 192, overflow: 'hidden' }}
    onWheelInput={(_, { wheelEvent, boxHeight }) => {
      const unit = wheelEvent.deltaMode === 1 ? 32 : wheelEvent.deltaMode === 2 ? boxHeight : 1
      setOffset(value => Math.max(0, Math.min(maxOffset, value + wheelEvent.deltaY * unit)))
    }}
  >
    <div style={{ transform: `translateY(${-offset}px)` }}>
      {Array.from({ length: 28 }, (_, index) => (
        <div key={index} style={{ height: 32 }}>Sample {index + 1}</div>
      ))}
    </div>
  </Capture>
</div>
```

The default `"settled"` activation waits for the pointer to rest inside Capture
(150ms, 5px tolerance). It stays active until the pointer leaves.
`wheelSettle.resetOnMove` requires settling again after movement beyond tolerance.
Scrolling a Capture under a stationary pointer does not activate it.

Use `"hover"` for immediate activation, `"focus"` for `:focus-within`, or
`"settled-or-focus"` for either condition. Wheel input must still target Capture.
Capture never takes focus automatically; provide `tabIndex` or a focusable child.

Modified input stays native by default, including Ctrl/pinch zoom. Use
`wheelModifier="ctrl"` to capture Ctrl-wheel, or `"any"` for all modifiers.
Named modifiers allow other keys too.

The innermost eligible Capture handles wheel input on its host. Canceled and
non-cancelable events are ignored; Capture cannot undo an ancestor's capture-phase
handler. Capture skips nested `textarea`, `select`, numeric/range inputs, and
Anta menus. Mark other native scroll panes with `data-capture-ignore`.

`detail.wheelEvent` preserves native event data, signs, and `deltaMode` units
(0: pixels, 1: lines, 2: pages). Capture does not infer OS scrolling preferences.
`localX` and `localY` are CSS pixels from Capture's viewport rectangle's top-left,
without undoing transforms. Native `offsetX` and `offsetY` refer to the original
target, which may be a child.

## Pointer sessions

`pointerCapture` sends raw data for one primary mouse, pen, or touch pointer,
including movement outside Capture. Your component interprets the gesture.
Use `threshold` to delay capture until dragging starts. Drag an area in the
preview, or select **Select sample area** with the keyboard.

```tsx title="Mouse or pen selection"
type Selection = { x: number; y: number; width: number; height: number }
const [selection, setSelection] = useState<Selection | null>(null)

<Button label="Select sample area" onClick={() => setSelection({ x: 24, y: 24, width: 100, height: 64 })} />
<Button label="Clear selection" onClick={() => setSelection(null)} />
<Capture
  className="pointer-probe-surface"
  aria-label="Pointer selection surface"
  pointerCapture={{ pointerTypes: ['mouse', 'pen'], threshold: 3 }}
  onPointerInput={(_, detail) => {
    if (detail.phase === 'cancel') return
    const x = Math.max(0, Math.min(detail.boxWidth, detail.localX))
    const y = Math.max(0, Math.min(detail.boxHeight, detail.localY))
    setSelection({
      x: Math.min(detail.start.localX, x), y: Math.min(detail.start.localY, y),
      width: Math.abs(x - detail.start.localX), height: Math.abs(y - detail.start.localY),
    })
  }}
>
  <Text size="small" priority="tertiary">Drag to select an area.</Text>
  {selection && <div className="pointer-probe-selection"
    style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }} />}
</Capture>
```

```css
.pointer-probe-surface { position: relative; height: 160px; overflow: hidden; border: 1px solid var(--border-4); border-radius: 8px; background: var(--bg-canvas); }
.pointer-probe-surface a-text { display: block; padding: 12px; }
.pointer-probe-selection { position: absolute; pointer-events: none; border: 1px solid var(--border-3-brand); background: color-mix(in oklch, var(--text-1-brand) 12%, transparent); }
```

`onPointerInput` reports `start`, `move`, `end`, and `cancel`. `deltaX/Y` are
incremental movement; `movementX/Y` are totals from the press, positive right/down.

Presses below threshold emit nothing. Captured gestures suppress the following
pointer-generated click. Cancellation reports `cancelReason` on pointer
cancellation, lost capture, disabling, removal, or window blur/hiding.
Lifecycle cancellation sets `pointerEvent: null`.
Capture cancels native behavior without stopping pointer-event propagation.

Pointer and pan capture skip nested native/ARIA controls, links, and editable content.
`pointerCapture.includeInteractive` includes them. Use `data-capture-ignore`
to exclude a subtree from all capture, including wheel. It does not remove
ancestor `touch-action` restrictions.

## Touch panning and inertia

`pan` converts touchscreen dragging into scroll deltas without inertia. It
captures the pointer internally; it does not require `pointerCapture`. Set
`pan.pointerTypes` to enable mouse or pen panning. If your component already
interprets touch gestures, use `pointerCapture` for touch and omit `pan`.

Enabling both for the same pointer type emits both streams. Assign separate
pointer types when each gesture should have one handler.

Try touch panning, or enable **Pan with mouse**. **Inertia** continues motion
after release; turn it off to stop when the pointer lifts.

```tsx title="Custom touch scrolling"
const [offset, setOffset] = useState(0)
const maxOffset = 18 * 32 - 160
const move = (delta: number) => setOffset(value => Math.max(0, Math.min(maxOffset, value + delta)))

// mouse and inertia come from the preview checkboxes.
<div onKeyDown={event => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  move(event.key === 'ArrowDown' ? 32 : -32)
}}>
  <Capture
    className="pan-probe-surface"
    tabIndex={0}
    aria-label="Pan capture surface"
    pan={{
      axis: 'y',
      pointerTypes: mouse ? ['touch', 'mouse'] : ['touch'],
      directions: { up: offset > 0, down: offset < maxOffset },
      inertia,
    }}
    onPanInput={(_, { deltaY }) => move(deltaY)}
  >
    <div style={{ transform: `translateY(${-offset}px)` }}>
      {Array.from({ length: 18 }, (_, index) => (
        <div className="pan-probe-row" key={index}>Sample {index + 1}</div>
      ))}
    </div>
  </Capture>
</div>
```

```css
.pan-probe-surface { height: 160px; overflow: hidden; border: 1px solid var(--border-4); border-radius: 8px; background: var(--bg-canvas); }
.pan-probe-row { height: 32px; box-sizing: border-box; padding: 6px 12px; border-bottom: 1px solid var(--border-5); }
```

Pan deltas oppose finger movement. Apply deltas from every phase, including
`release`. Inertia samples have `pointerEvent: null`. Motion stops on new input,
disabled directions, or cancellation.

Capture sets CSS `touch-action` before contact. Single-axis pan leaves the other
axis and pinch zoom to the browser. Both-axis pan or touch pointer capture owns
the whole gesture; mouse-only capture leaves touch unchanged. Unlike wheel,
an active touch gesture cannot return to native scrolling at a bound. Update
directions to stop custom motion and control the next gesture.
Empty pointer-type or button lists disable that capability without restricting
native text selection or touch gestures.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onPanInput?` | (event, detail) => void | — | Custom pan motion and its lifecycle. Inertial samples have no native pointer event. |
| `onPointerInput?` | (event, detail) => void | — | Start, movement, end, and cancellation of an opted-in pointer session. |
| `onWheelInput?` | (event, detail) => void | — | Accepted wheel input, with a serialized original event, Capture-relative geometry, focus state, and activation reason. Cancellation is already complete. |
| `pan?` | boolean \| CapturePan | — | Emit custom pan motion. `true` enables touch panning on both axes without momentum. Options select devices, axes, bounds directions, and optional inertia. Captures the pointer internally; `pointerCapture` is not required. Sets CSS touch-action through attributes before the gesture starts. |
| `pointerCapture?` | boolean \| CapturePointerCapture | — | Emit raw data for a primary pointer until release or cancellation. An options object filters devices/buttons and configures activation. Nested interactive controls are excluded unless explicitly included. A listener alone enables nothing. |
| `wheelActivation?` | CaptureWheelActivation | settled | Pointer or focus condition required before wheel input can be captured. Focus applies only to input targeted within this Capture. |
| `wheelCapture?` | CaptureInputDirections | — | Capture wheel input in the enabled directions and emit `onWheelInput`. `true` accepts all directions. Omit or pass `false` to leave wheel input alone. Nested native wheel controls and Anta menus are excluded. All-false direction bounds preserve pointer settling while declining input. A listener alone never enables capture. |
| `wheelModifier?` | CaptureInputModifier | none | Required modifier for wheel capture. `none` preserves browser Ctrl/pinch zoom. |
| `wheelSettle?` | CaptureWheelSettle | { delay: 150, tolerance: 5, resetOnMove: false } | Dwell delay, movement tolerance, and whether movement resets eligibility. |

### CaptureWheelSettle

| Option | Type | Default | Description |
|------|------|---------|-------------|
| `delay?` | number | 150 | Pointer dwell time in milliseconds. |
| `resetOnMove?` | boolean | false | Restart dwell after movement beyond tolerance, including after activation. |
| `tolerance?` | number | 5 | Maximum movement from the dwell anchor on either axis, in CSS pixels. |

### CapturePointerCapture

| Option | Type | Default | Description |
|------|------|---------|-------------|
| `buttons?` | readonly number[] | [0] | Accepted initiating buttons, using PointerEvent.button values. |
| `includeInteractive?` | boolean | false | Allow capture to start on nested native or ARIA controls, links, or editable regions. |
| `modifier?` | CaptureInputModifier | any | Modifier required to start a capture session. |
| `pointerTypes?` | readonly CapturePointerType[] | ['mouse', 'pen', 'touch'] | Accepted pointer devices. One primary pointer is tracked per Capture. |
| `threshold?` | number | 0 | Movement required before activation, in viewport CSS pixels. |

### CapturePan

| Option | Type | Default | Description |
|------|------|---------|-------------|
| `axis?` | 'x' \| 'y' \| 'both' | both | Axes handled by custom panning. CSS touch-action leaves the other axis to the browser. |
| `directions?` | CaptureInputDirections | true | Allowed scroll directions. Updating these can stop motion at application bounds. |
| `inertia?` | boolean \| CapturePanInertia | false | Continue panning after release with browser-side velocity decay. |
| `pointerTypes?` | readonly CapturePointerType[] | ['touch'] | Accepted pointer devices. |
| `threshold?` | number | 3 | Movement required before activation, in viewport CSS pixels. |

### CapturePanInertia

| Option | Type | Default | Description |
|------|------|---------|-------------|
| `minVelocity?` | number | 0.02 | Stop when speed on both axes falls below this value, in CSS pixels/ms. |
| `timeConstant?` | number | 325 | Exponential velocity decay time constant in milliseconds. |

### CaptureWheelInput

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `activationReason` | CaptureWheelActivationReason | — |  |
| `boxHeight` | number | — |  |
| `boxWidth` | number | — | Dimensions of the same viewport bounding rectangle, in CSS pixels. |
| `focusWithin` | boolean | — |  |
| `inside` | boolean | — | Whether the pointer is inside that rectangle. Capture can continue outside it. |
| `localX` | number | — | Pointer position relative to the viewport bounding rectangle's top-left, in CSS pixels. |
| `localY` | number | — |  |
| `wheelEvent` | SerializedWheelEvent | — |  |

### CapturePointerInput

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `activationReason` | CapturePointerActivationReason | — |  |
| `boxHeight` | number | — |  |
| `boxWidth` | number | — | Dimensions of the same viewport bounding rectangle, in CSS pixels. |
| `deltaX` | number | — | Movement since the previous delivered sample, in viewport CSS pixels. |
| `deltaY` | number | — |  |
| `focusWithin` | boolean | — |  |
| `inside` | boolean | — | Whether the pointer is inside that rectangle. Capture can continue outside it. |
| `localX` | number | — | Pointer position relative to the viewport bounding rectangle's top-left, in CSS pixels. |
| `localY` | number | — |  |
| `movementX` | number | — | Total movement from the initial press, in viewport CSS pixels. |
| `movementY` | number | — |  |
| `phase` | 'start' \| 'move' \| 'end' \| 'cancel' | — |  |
| `pointerEvent` | SerializedPointerEvent \| null | — | Null when cancellation comes from lifecycle or configuration changes. |
| `start` | CapturePointerStart | — |  |
| `cancelReason?` | CaptureInputCancelReason | — |  |

### CapturePanInput

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `activationReason` | CapturePointerActivationReason | — |  |
| `boxHeight` | number | — |  |
| `boxWidth` | number | — | Dimensions of the same viewport bounding rectangle, in CSS pixels. |
| `deltaX` | number | — | Incremental scroll motion in viewport CSS pixels. |
| `deltaY` | number | — |  |
| `focusWithin` | boolean | — |  |
| `inside` | boolean | — | Whether the pointer is inside that rectangle. Capture can continue outside it. |
| `localX` | number | — | Pointer position relative to the viewport bounding rectangle's top-left, in CSS pixels. |
| `localY` | number | — |  |
| `phase` | 'start' \| 'move' \| 'release' \| 'inertia' \| 'end' \| 'cancel' | — |  |
| `pointerEvent` | SerializedPointerEvent \| null | — | Null during momentum or cancellation without a pointer event. |
| `start` | CapturePointerStart | — |  |
| `velocityX` | number | — | Scroll velocity in viewport CSS pixels/ms. |
| `velocityY` | number | — |  |
| `cancelReason?` | CaptureInputCancelReason | — |  |

## Web component

Use `<a-capture>` without JSX. Events are non-bubbling `CustomEvent`s
with the same `detail`. Adding listeners enables no capabilities.

Import `@antadesign/anta/elements/a-capture` to register the element. A bare
Capture leaves wheel and touch scrolling native:

```html title="a-capture"
<a-capture class="native-capture">
  <p>Native scrolling stays enabled.</p>
  <p>No wheel, pointer, or pan input is captured.</p>
  <p>Scroll to the end of this content.</p>
  <p>The browser owns this scroll position.</p>
</a-capture>
```

```css
.native-capture { width: 100%; height: 120px; overflow: auto; padding: 12px; border: 1px solid var(--border-4); border-radius: 8px; }
.native-capture p { margin: 0; padding-block: 12px; }
```

Configure capture with attributes such as `wheel-capture="up down"` or `pan="y"`.
Bare capability attributes match passing `true` in JSX. Remove an attribute to
disable it. Listen for `wheelinput`, `pointerinput`, and `paninput` with
`addEventListener`; each event exposes the same `detail` as the JSX handler.

## Styling

Capture renders a block container with no shadow root. Use `className` or
`style` for layout, size, and appearance. Keep a CSS box on the host so its
bounds define the input surface and local coordinates.

Use [Box](./box.md) around Capture when you also need measurements, context events,
or edge fades. Box measures its own bounds; Capture reports coordinates relative
to its own bounds.
