# Box

`Box` is a DOM container with layout props, overflow states, browser context
events, and opt-in input capture.

## Display

`display` and `gap` set the matching CSS properties. A numeric `gap` uses
pixels. A string accepts any CSS length.

```tsx
<Box round={8}><span /></Box>
<Box display="flex" round={8} gap={6}><span /></Box>
<Box display="grid" round={8} gap="0.5rem" style={{ gridTemplateColumns: '1fr 1fr' }}><span /></Box>
```

`round` accepts the same values. Pass `round` for fully rounded corners. Omit
it for square corners.

`display`, `gap`, and `round` use the `anta.components` layer. Your
`className` and `style` override them.

## Overflow

Box reports when content exceeds its bounds (`overflowX` and `overflowY`), when
CSS clips it (`clippedX` and `clippedY`), and when it can scroll (`scrollableX`
and `scrollableY`). It exposes each measurement as a CSS state, so CSS can react
without JSX state or a measurement ref.

A Box measures for `fade`, `onMeasureChange`, or `observe="size"`. Use
`observe="size"` when CSS reads its states. A Box with none of these attaches no
observers. Measurement pauses off screen, except `fade`, which measures on
connection so it can paint its mask.

`observe` accepts `"size"`, `"context"`, or `"all"`. A bare `observe` means
`"all"`. The JSX `Box` derives the needed value from its handlers. When you use
`a-box` directly, set it yourself; `addEventListener` does not start reporting:

```html
<a-box observe="size">Content</a-box>
<a-box observe="all">Content</a-box>
```

The attribute works with listeners added before upgrade, removed with `once` or
`AbortSignal`, and replaced during React renders.

`.edge` is a demo class name. Use your own selector.

```tsx
<Box observe="size" round={8} className="edge" style={{ width: 150 }}>Content that fits.</Box>

<Box observe="size" round={8} className="edge" style={{ width: 150, overflow: 'hidden', whiteSpace: 'nowrap' }}>
  A label too long for this box.
</Box>

<Box observe="size" round={8} className="edge" style={{ width: 150, height: 56, overflowY: 'auto' }}>
  One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten.
</Box>
```

```css
.edge:state(clipped-x) { border-color: var(--border-3-warning); }
.edge:state(scrollable-y) { border-color: var(--border-3-info); }
```

### Fading a clipped edge

`fade` masks each edge that hides content. Scrolling moves the mask to the edge
that still hides content and removes it at the end. `fadeSize` sets its depth.

```tsx
<Box fade fadeSize={32} round display="flex" gap={6} style={{ overflowX: 'auto' }}>
  {TAGS.map((t) => <Tag key={t} size="small" label={t} />)}
</Box>
```

The mask clips to the padding box. It preserves the Box border, shadows, and
focus ring when no edge is hidden.

The four edge states are `hidden-start-x`, `hidden-end-x`, `hidden-start-y`, and
`hidden-end-y`. Use `hiddenStartX` and its siblings in JSX. To style the states
without `fade`, add `observe="size"`.

```css
/* <Box observe="size" className="my-box"> */
.my-box:state(hidden-end-x) {
  mask-image: linear-gradient(to right, black calc(100% - 2rem), transparent);
}
```

### Tooltip on clipped content

`Tooltip truncatedOnly` uses Box's `isTruncated` getter. It shows when the Box
clips on either axis, including wrapped children.

```tsx
const TAGS = ['frontend', 'design-system', 'a11y', 'performance']

<Box display="flex" round={8} gap={6} className="tag-box" style={{ height: 34 }}>
  {TAGS.map((t) => <Tag key={t} size="small" label={t} />)}
  <Tooltip truncatedOnly>{TAGS.join(' · ')}</Tooltip>
</Box>
```

```css
.tag-box { flex-wrap: wrap; padding: 6px; overflow: hidden; }
```

## Measurements

`measurechange` fires one frame after observation starts and after the Box or its
content changes. `changed` contains the moved fields, and `current` is the full
snapshot. The event pauses off screen and reports again when the Box returns.

```tsx title="measurechange"
<Box
  style={{ maxWidth: 210, overflow: 'hidden', whiteSpace: 'nowrap' }}
  onMeasureChange={(_, { changed, current }) => {
    // changed → { clippedX: true, scrollWidth: 412 }
    if (changed.clippedX) setShowOverflowHint(current.clippedX)
  }}
>
  Long account name
</Box>
```

The preview updates as you resize or scroll the Box. Tags mark `true` values.

[`BoxMeasurement`](#boxmeasurement) lists every field. Box maps each overflow
field to a kebab-case CSS state, such as `overflow-x`, `clipped-y`,
`scrollable-x`, and `hidden-end-y`. These states are not host attributes. They
remain current only while `fade`, `observe="size"`, or `onMeasureChange` enables
measurement.

## Context

`contextchange` uses the same `{ changed, current }` shape. Boxes share one
context observer per window, which stops when the last context reader
disconnects.

[`BoxContext`](#boxcontext) lists every field. `contextchange` sets no CSS
states. Use `:focus-within`, mode classes, and media queries when CSS is the
reader.

Every value in the following preview is live. Switch the site theme, resize the
window, zoom the page, or use a touch device. Treat `osVersion` and
`browserVersion` as hints because browsers freeze parts of these values. Use
`pointer`, `hover`, or a feature test to gate behavior. The second Box is in a
`.light` scope, so its `mode` remains `light` on a dark page while `globalMode`
follows the document.

### Canvas-related styles

`context.font` is the Box's resolved text style, `context.inset` measures from
the border edge to the content edge, and `devicePixelRatio` provides the canvas
scale. Use them to align canvas text with the DOM.

`measurement` cannot derive the inset: `width` is the border box, and
`clientWidth` is the padding box.

Set `ctx.font` from `font.shorthand` first. Chromium and Firefox reset
`fontStretch`, `fontVariantCaps`, `fontKerning`, and `textRendering` when
`ctx.font` changes. `stretch` and `variantCaps` stay out of the shorthand because
a percentage `font-stretch` invalidates it.

```tsx title="canvas"
<Box
  onContextChange={(_, { current }) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const { font, devicePixelRatio: dpr } = current
    canvas.width = 300 * dpr
    canvas.height = 80 * dpr
    ctx.scale(dpr, dpr)

    ctx.font = font.shorthand
    ctx.fontStretch = font.stretch
    ctx.fontVariantCaps = font.variantCaps
    ctx.fontKerning = font.kerning
    ctx.textRendering = font.textRendering
    ctx.letterSpacing = font.letterSpacing
    ctx.wordSpacing = font.wordSpacing
    ctx.direction = font.direction
    ctx.fillStyle = font.color

    const x = current.inset.borderLeft + current.inset.paddingLeft
    const y = current.inset.borderTop + current.inset.paddingTop
    ctx.fillText('Matches the DOM', x, y + (font.lineHeight ?? font.size))
  }}
>
  <canvas ref={canvasRef} />
</Box>
```

`getComputedStyle(element).font` is empty in Chromium, Firefox, and WebKit, so
Box assembles the shorthand.

```tsx title="contextchange"
<Box onContextChange={(_, { changed, current }) => {
  if (changed.mode) updatePreviewTheme(current.mode)
  if (changed.focusWithin) announceFocus(current.focusWithin)
}}>
  <span>Preview content</span>
</Box>
```

## Capture wheel, pointer and touch

`wheelCapture`, `pointerCapture`, and `pan` are independent opt-ins. Their
handlers alone enable nothing. A plain Box allocates no input state and adds no
input listeners. Processing functions are shared; gesture state exists only
while needed. Input does not enable size or context observation.

Box decides ownership and cancels accepted native input on the browser thread.
It then emits a custom event with plain data. Your table or plot decides how to
scroll, zoom, select, or draw. Send the event's `detail` through your worker
bridge; the `CustomEvent` itself is not serializable. Returning a value from a
handler cannot change cancellation of the original input.

### Wheel ownership

`wheelCapture={true}` accepts every direction. A direction object accepts only
its `true` entries. Update it from your scroll or zoom bounds; declined input
continues to the enclosing editor or scroll container. Ownership follows the
dominant axis of each event. Once accepted, both original deltas are delivered
unchanged, so your component still decides how to use diagonal input.

```tsx title="Custom table wheel"
<Box
  wheelCapture={{ up: offset > 0, down: offset < maxOffset }}
  wheelActivation="settled-or-focus"
  wheelSettle={{ delay: 150, tolerance: 5, resetOnMove: false }}
  onWheelInput={(_, { wheelEvent, localX, localY, activationReason }) => {
    handleTableWheel({ wheelEvent, localX, localY, activationReason })
  }}
>
  {tableContent}
</Box>
```

The default activation is `"settled"`: a real pointer movement into the Box
starts a 150ms dwell with 5px tolerance. Eligibility lasts until the pointer
leaves that Box. `resetOnMove: true` requires another dwell after movement
beyond tolerance. Wheel events invalidate dwell for regions no longer under
the pointer; they do not activate a new region scrolled underneath it.

`"hover"` accepts immediately. `"focus"` requires `:focus-within`;
`"settled-or-focus"` accepts either condition. Focus never redirects wheel
input from elsewhere, and Box never takes focus automatically. Supply
`tabIndex` or a focusable child when focus activation is useful.

By default, modified input remains native, including Ctrl/pinch zoom. Set
`wheelModifier="ctrl"` for an explicitly owned Ctrl-wheel zoom surface, or
`"any"` to accept all modifiers. `"alt"`, `"meta"`, and `"shift"` are also
available. A named modifier requires that key but allows other modifiers.

Box listens for wheel input on its own host. Settled Boxes share passive
document listeners to track pointer dwell; those listeners never claim input.
The innermost eligible Box wins through normal bubbling. Already-cancelled or
non-cancelable events are declined. An ancestor that intercepts an event during
capture runs before Box and cannot be undone by it.

`wheelEvent` preserves `deltaX`, `deltaY`, `deltaZ`, `deltaMode`, timestamps,
coordinates, buttons, modifiers, and cancellation flags. Units stay native:
0 means pixels, 1 lines, and 2 pages. Use the delivered signs; Box does not
infer an OS natural-scrolling preference or normalize units.

`localX` and `localY` are viewport CSS pixels from the Box bounding rectangle's
top-left. `boxWidth` and `boxHeight` describe that same rectangle, including
CSS transforms, without undoing rotation or scaling. Native `offsetX` and
`offsetY` remain in `wheelEvent` and refer to the event target, which may be a
child. Every input also includes `inside` and `focusWithin`.

### Pointer sessions

`pointerCapture` emits `start`, `move`, `end`, and `cancel` through
`onPointerInput`. It supports mouse, pen, and touch without device sniffing.
Filter `pointerTypes`, initiating `buttons`, and `modifier`, or set a movement
`threshold` before capture begins. Box tracks one primary pointer at a time
and retains native pointer capture outside its bounds.

```tsx title="Mouse or pen selection"
<Box
  pointerCapture={{ pointerTypes: ['mouse', 'pen'], threshold: 3 }}
  onPointerInput={(_, { phase, start, localX, localY, movementX, movementY }) => {
    updateSelection({ phase, start, localX, localY, movementX, movementY })
  }}
>
  {plotContent}
</Box>
```

`pointerEvent` is a serialized pointer sample. `start` preserves the initial
press and geometry. `deltaX/Y` are incremental physical movement;
`movementX/Y` are total physical movement from that press. Positive means
right/down. This differs from the old RemoteVirtualDOM MouseCapture's
start-minus-current deltas: negate these totals when adapting that protocol.

`activationReason` is `"pointer-down"` or `"drag-threshold"`. A pending press
that never crosses its threshold emits nothing. A captured gesture suppresses
its following pointer-generated click. Cancellation includes `cancelReason`
and occurs on pointer cancellation, lost capture, disabling, removal, or loss
of window visibility/focus. Lifecycle cancellation has `pointerEvent: null`.

Nested controls, links, and editable regions are excluded from pointer and pan
activation. `pointerCapture={{ includeInteractive: true }}` includes them.
Mark a subtree with `data-box-input-ignore` to exclude all three input
capabilities, including wheel. This excludes event handling, not the ancestor's
CSS `touch-action` restriction.

### Touch panning and inertia

`pan` enables custom touch panning on both axes, without inertia. An options
object can select devices, an axis, a threshold, and allowed scroll directions.
For mouse dragging as well, set `pointerTypes: ['touch', 'mouse']`. Raw pointer
sessions and pan motion can be enabled together; they share one capture.

```tsx title="Custom touch scrolling"
<Box
  pan={{
    axis: 'y',
    directions: { up: offset > 0, down: offset < maxOffset },
    inertia: { timeConstant: 325, minVelocity: 0.02 },
  }}
  onPanInput={(_, { deltaY, phase }) => {
    setOffset(value => Math.max(0, Math.min(maxOffset, value + deltaY)))
  }}
>
  {tableContent}
</Box>
```

Pan deltas are scroll motion, opposite to physical finger movement. Phases are
`start`, `move`, `release`, optional `inertia`, then `end`; interruption emits
`cancel`. Apply the deltas from `release` too. Velocity is CSS pixels per
millisecond. Momentum samples have `pointerEvent: null`; they are generated
motion, not synthetic native touch events. Inertia is time-based, independent
per Box, and stops on new input, disabled directions, or lifecycle cleanup.

Touch ownership is declared before contact through CSS `touch-action`.
`axis: 'x'` leaves vertical panning and pinch zoom to the browser; `'y'`
leaves horizontal panning and pinch zoom. `'both'`, or raw pointer capture that
includes touch, owns the whole touch gesture. Mouse-only options leave native
touch behavior unchanged. Declared ownership cannot transfer an ongoing custom
gesture back to native scrolling at a bound; update directions to stop custom
motion and choose ownership for the next gesture.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `display?` | BoxDisplay | block | Layout model for the host. All other layout, sizing, mask, and shadow
properties stay ordinary `className` / `style` CSS on the Box itself. |
| `fade?` | boolean | — | Fades out every edge that currently hides clipped content, and drops the
fade from an edge once the reader scrolls to it. |
| `fadeSize?` | number \| string | 24 | Depth of the `fade` gradient. A `number` is pixels; a string is any CSS
length. |
| `gap?` | number \| string | — | Gap between children, matching the CSS `gap` property. A `number` is
pixels; a string is any CSS length or two-value gap (`'1rem'`,
`'8px 16px'`). Applies while the Box is a flex or grid container. |
| `observe?` | 'size' \| 'context' \| 'all' | — | What the Box watches, when a handler is not what turns it on. `'size'`
keeps the overflow CSS states (`:state(clipped-x)`, `:state(scrollable-y)`,
…) current — reach for it when your own CSS is the only reader. `'context'`
and `'all'` are there for symmetry; passing `onMeasureChange` or
`onContextChange` already turns the matching half on. |
| `onContextChange?` | (event, detail) => void | — | Fired after Box's browser and local rendering context changes. `detail`
contains the changed fields and a full current snapshot. |
| `onMeasureChange?` | (event, detail) => void | — | Fired after Box geometry or its content-overflow state changes. `detail`
contains the changed fields and a full current snapshot. |
| `onPanInput?` | (event, detail) => void | — | Custom pan motion and its lifecycle. Inertial samples have no native pointer event. |
| `onPointerInput?` | (event, detail) => void | — | Start, movement, end, and cancellation of an opted-in pointer session. |
| `onWheelInput?` | (event, detail) => void | — | Accepted wheel input, with a serialized original event, Box-relative
geometry, focus state, and activation reason. Cancellation is already complete. |
| `pan?` | boolean \| BoxPan | — | Emit custom pan motion. `true` enables touch panning on both axes without
momentum. Options select devices, axes, bounds directions, and optional inertia.
Sets CSS touch-action through attributes before the gesture starts. |
| `pointerCapture?` | boolean \| BoxPointerCapture | — | Capture a primary pointer until release or cancellation. An options object
filters devices/buttons and configures activation. Nested interactive controls
are excluded unless explicitly included. A listener alone enables nothing. |
| `round?` | boolean \| number \| string | — | Fully-round corners (`border-radius: 999px`, clamped to the box). Pass a
`number` (px) or a CSS length string (`'1rem'`) for a custom radius. Omit
for square corners. |
| `wheelActivation?` | BoxWheelActivation | settled | Pointer or focus condition required before wheel input can be captured.
Focus applies only to input targeted within this Box. |
| `wheelCapture?` | BoxInputDirections | — | Capture wheel input in the enabled directions and emit `onWheelInput`.
`true` accepts all directions. Omit or pass `false` to leave wheel input alone.
A listener alone never enables capture. |
| `wheelModifier?` | BoxInputModifier | none | Required modifier for wheel capture. `none` preserves browser Ctrl/pinch zoom. |
| `wheelSettle?` | BoxWheelSettle | { delay: 150, tolerance: 5, resetOnMove: false } | Dwell delay, movement tolerance, and whether movement resets eligibility. |

### BoxMeasurement

The `measurechange` payload, as `changed` (only what moved) and `current` (the
whole snapshot).

### BoxContext

The `contextchange` payload, in the same two shapes.

### BoxFont

`context.font`, the resolved text style.

### BoxInset

`context.inset`, the distance from the border edge to the content edge.

### BoxWheelSettle

### BoxPointerCapture

### BoxPan

### BoxPanInertia

### BoxWheelInput

### BoxPointerInput

### BoxPanInput

Use `<a-box>` when you assemble DOM without a JSX wrapper. Its events are
ordinary, non-bubbling `CustomEvent`s carrying the same detail object.

```html title="a-box"
<a-box display="grid" gap="8px" round="12px" observe="all" id="summary"
       style="overflow: auto; max-height: 16rem">
  <p>Summary content</p>
</a-box>

<script type="module">
  import '@antadesign/anta/elements/a-box'

  const box = document.querySelector('#summary')
  box.addEventListener('measurechange', ({ detail }) => {
    console.log(detail.changed, detail.current.scrollableY)
  })
  box.addEventListener('contextchange', ({ detail }) => {
    console.log(detail.changed, detail.current.mode)
  })
</script>
```

`gap`, `round`, and `fade-size` read their length through typed `attr()`, which
today only Chrome supports. The matching custom properties in the host's inline
style work everywhere and take precedence, so that is what the JSX wrapper sets:

```html
<a-box gap round fade
       style="--box-gap: 8px; --box-round: 12px; --box-fade-size: 32px">Content</a-box>
```

`box.measurement`, `box.context`, and `box.isTruncated` read the same values
synchronously.

Input configuration uses attributes; callbacks use the matching lowercase
event names. A bare `wheel-capture` accepts all directions. A bare
`pointer-capture` accepts mouse, pen, and touch; a bare `pan` enables touch
panning on both axes. Remove the capture attribute to disable that capability.

```html title="Browser-thread input"
<a-box wheel-capture="up down" wheel-activation="settled-or-focus"
       wheel-delay="150" wheel-tolerance="5"
       pan="y" pan-directions="up down" pan-inertia id="table-surface">
  Custom table content
</a-box>
<script type="module">
  const surface = document.querySelector('#table-surface')
  surface.addEventListener('wheelinput', ({ detail }) => handleWheel(detail))
  surface.addEventListener('paninput', ({ detail }) => handlePan(detail))
</script>
```
